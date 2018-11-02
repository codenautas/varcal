"use strict";

import * as ExpresionParser from 'expre-parser';


export function getAggregacion(f: string, exp: string) {
    switch (f) {
        case 'sumar':
            return 'sum(' + exp + ')';
        case 'min':
            return 'min(' + exp + ')';
        case 'max':
            return 'max(' + exp + ')';
        case 'contar':
            return 'count(nullif(' + exp + ',false))';
        case 'promediar':
            return 'avg(' + exp + ')';
        default:
            return f + '(' + exp + ')';
    }
}


export function buildWhereConditions(leftAlias:string, rigthAlias:string, columnsToJoin: string[]){
    return columnsToJoin.map((col: string) =>
        `${leftAlias}.${col} = ${rigthAlias}.${col}`
    ).join(' and ');
}


export function getInsumos(expression: string): ExpresionParser.Insumos {
    return ExpresionParser.parse(expression).getInsumos();
}

export function getWrappedExpression(expression: string|number, pkExpression: string, options: ExpresionParser.CompilerOptions): string {
    var compiler = new ExpresionParser.Compiler(options);
    return compiler.toCode(ExpresionParser.parse(expression), pkExpression);
}

export const sufijo_agregacion:string='_agg';






// Se reactiva codigo antiguo para de separarGruposPorOirgenYNivel 
// para testear > debuguear > documentar > modularizar > refactorizar > llevar al modelo lo que sirva

export interface AliasDefEst{
    on: string
    tabla_datos: string
    where?: string
}

export interface Alias extends AliasDefEst{
    operativo: string
    alias: string
    descripcion?: string
}

export type PrefixedPks = {[key:string]: {pks:string[], pksString: string}};

export interface Join {
    tabla: string,
    clausulaJoin: string
};

export interface VariableGenerable{
    tabla?: string
    nombreVariable: string
    expresionValidada: string
    funcion_agregacion?: 'contar' | 'sumar' | 'promediar'
    tabla_agregada?: string
    insumos?: ExpresionParser.Insumos
    joins?: Join[]
    aliases?: Aliases
}

export type ParametrosGeneracion = {
    nombreFuncionGeneradora: string,
    esquema: string
}

export type TextoSQL = string;

export type BloqueVariablesGenerables = {
    tabla: string
    variables: VariableGenerable[]
    joins?: Join[]
};
export type DefinicionEstructuralTabla = {
    operativo?: string;
    target?: string;
    sourceBro?: string;
    pks?:string[];
    sourceJoin?: string;
    where?: string;
    aliasAgg?: string;
    sourceAgg?: string;
    whereAgg?:{ 
        [key: string]: string
    }    
};

export type Tables = {
    [key: string]: DefinicionEstructuralTabla
}

export type DefinicionEstructural = {
    aliases?: Aliases
    tables: Tables
}

export interface VariableDefinida{
    tabla: string
    clase?: string
}

export interface VariablesDefinidas{
    [key:string]: VariableDefinida
}

export interface Aliases {
    [key: string]: AliasDefEst
}


function checkInsumos(defVariable: VariableGenerable, vardef: string[], definicionesOrd: VariableGenerable[], nvardef: VariableGenerable[], defEst: DefinicionEstructural): boolean {
    var { nombreVariable, insumos } = defVariable;
    var cantDef: number = 0;
    insumos.variables.forEach(function (varInsumos) {
        // si esta variable tiene un prefijo && la variable sin prefijo está definida && el prefijo está en la tabla de aliases
        if (hasTablePrefix(varInsumos) && defEst) {
            var [prefix, varName] = varInsumos.split('.');
            if (vardef.indexOf(varName) > -1 && (prefix in { ...defEst.tables, ...defEst.aliases })) {
                vardef.push(varInsumos);// then agrego esta variable a vardef
            }
        }
        cantDef = vardef.indexOf(varInsumos) >= 0 ? cantDef + 1 : cantDef;
    });
    if (cantDef == insumos.variables.length) {
        vardef.push(nombreVariable);
        definicionesOrd.push(defVariable);
        if (nvardef.indexOf(defVariable) >= 0) {
            nvardef.splice(nvardef.indexOf(defVariable), 1)
        }
    }
    return cantDef == insumos.variables.length;
}

function hasTablePrefix(variable: string){
    return variable.match(/^.+\..+$/);
}

/**
 * @param nvardef son las que variables a calcular cuyos insumos no están en vardef
 * @param variablesDefinidas variables con insumos definidos
 */
export function separarEnGruposPorNivelYOrigen(nvardef: VariableGenerable[], variablesDefinidas: string[], defEst?: DefinicionEstructural): BloqueVariablesGenerables[] {
    var listaOut: BloqueVariablesGenerables[] = [];
    var lenAnt: number;
    var definicionesOrd: VariableGenerable[] = [];
    var compararJoins = function (joins1: Join[], joins2: Join[]) {
        return (joins1 === undefined && joins2 === undefined ||
            JSON.stringify(joins1) === JSON.stringify(joins2)) ? true : false;
    };
    var nuevoBloqueListaOut = function (defVariable: VariableGenerable): BloqueVariablesGenerables {
        var {joins, ...varAnalizada } = defVariable;
        var nuevo: BloqueVariablesGenerables = { tabla: defVariable.tabla, variables: [varAnalizada] };
        if (joins !== undefined) {
            nuevo.joins = joins;
        }
        return nuevo;
    };
    do {
        lenAnt = nvardef.length;
        var i = 0;
        while (i < nvardef.length) {
            if (!checkInsumos(nvardef[i], variablesDefinidas, definicionesOrd, nvardef, defEst)) {
                i++;
            }
        };
    } while (nvardef.length > 0 && nvardef.length != lenAnt);
    if (nvardef.length > 0) {
        throw new Error("Error, no se pudo determinar el orden de la variable '" + nvardef[0].nombreVariable + "' y otras")
    }
    definicionesOrd.forEach(function (defVariable: VariableGenerable) {
        var {joins, ...varAnalizada } = defVariable;
        let tabla = defVariable.tabla;
        if (listaOut.length == 0) {
            listaOut.push(nuevoBloqueListaOut(defVariable));
        } else {
            var enNivel = defVariable.insumos.variables.length ? defVariable.insumos.variables.map(function (varInsumo) {
                return listaOut.findIndex(function (nivel) {
                    return nivel.variables.findIndex(function (vvar) {
                        return vvar.nombreVariable == varInsumo
                    }) == -1 ? false : true
                })
            }).reduce(function (elem: number, anterior: number) {
                return elem > anterior ? elem : anterior;
            }) : 0;
            if (enNivel >= 0 && listaOut.length === enNivel + 1) {
                listaOut.push(nuevoBloqueListaOut(defVariable));
            } else {
                var nivelTabla = listaOut[enNivel + 1].tabla == tabla && compararJoins(listaOut[enNivel + 1].joins, joins) ? enNivel + 1 : listaOut.findIndex(function (nivel, i) {
                    return nivel.tabla == tabla && compararJoins(nivel.joins, joins) && i > enNivel + 1
                });
                if (nivelTabla >= 0) {
                    listaOut[nivelTabla].variables.push(varAnalizada);
                } else {
                    listaOut.push(nuevoBloqueListaOut(defVariable));
                }
            }
        }
    });
    //console.log(JSON.stringify(listaOut));
    return listaOut;
}