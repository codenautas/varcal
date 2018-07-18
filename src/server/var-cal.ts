"use strict";

import * as ExpresionParser from 'expre-parser';
import * as likear          from 'like-ar';

import * as typesVarcal from "./types-varcal";
import { tiposTablaDato } from 'operativos';

export const sufijo_agregacion:string='_agg';

export {CompilerOptions} from 'expre-parser';

export interface DefinicionVariable {
    tabla: string
    nombreVariable: string
    expresionValidada: string
};

export interface Joins {
    tabla: string,
    clausulaJoin: string
};

export interface DefinicionVariableAnalizada extends DefinicionVariable {
    insumos: ExpresionParser.Insumos
    joins?: Joins[]
}

export interface VariableGenerable {
    nombreVariable: string
    expresionValidada: string
    funcion_agregacion?: 'contar' | 'sumar'
    tabla_agregada?: string
    insumos?: {
        variables?: string[]
        aliases?: string[]
        funciones?: string[]
    }
}

export type ParametrosGeneracion = {
    nombreFuncionGeneradora: string,
    esquema: string
}

export type TextoSQL = string;

export type BloqueVariablesGenerables = {
    tabla: string
    variables: VariableGenerable[]
    joins?: Joins[]
};

export type DefinicionEstructuralTabla = {
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
    detailTables?: typesVarcal.DetailTable[];
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
    [key: string]: typesVarcal.AliasDefEst
}

//export type  ListaVariablesAnalizadasOut=ListaVariablesAnalizadas[];

function getAggregacion(f: string, exp: string) {
    switch (f) {
        case 'sumar':
            return 'sum(' + exp + ')';
        case 'contar':
            return 'count(nullif(' + exp + ',false))';
        default:
            return f + '(' + exp + ')';
    }
}

// construye una sola regex con 3 partes (grupos de captura) de regex diferentes, y hace el reemplazo que se pide por parametro
function regexpReplace(guno:string, gdos:string, gtres:string, sourceStr:string, replaceStr:string){
    let completeRegex = guno+gdos+gtres;
    return sourceStr.replace(new RegExp(completeRegex, 'g'), '$1'+ replaceStr+'$3');
}

function prefijarExpresion(v: VariableGenerable, variablesDefinidas:VariablesDefinidas){
    v.insumos.variables.forEach(varInsumo => {
        if ( ! hasTablePrefix(varInsumo) && ( ! v.insumos.funciones || v.insumos.funciones.indexOf(varInsumo) == -1) && variablesDefinidas[varInsumo]){
            let prefix = (variablesDefinidas[varInsumo].clase == 'calculada')? variablesDefinidas[varInsumo].tabla + '_' + tiposTablaDato.calculada : variablesDefinidas[varInsumo].tabla;
            let varWithPrefix = prefix + '.' + varInsumo;

            // Se hacen 3 reemplazos porque no encontramos una regex que sirva para reemplazar de una sola vez todos
            // los casos encontrados Y un caso que esté al principio Y un caso que esté al final de la exp validada
            let baseRegex = `(${varInsumo})`;
            let noWordRegex = '([^\w\.])';
            v.expresionValidada = regexpReplace(noWordRegex, baseRegex, noWordRegex, v.expresionValidada, varWithPrefix); // caso que reemplaza casi todas las ocurrencias en la exp validada
            v.expresionValidada = regexpReplace('^()', baseRegex, noWordRegex, v.expresionValidada, varWithPrefix); // caso que reemplaza una posible ocurrencia al principio
            v.expresionValidada = regexpReplace(noWordRegex, baseRegex, '()$', v.expresionValidada, varWithPrefix); // caso que reemplaza una posible ocurrencia al final
        }
    });
}

export function generateConditions (left:string, rigth:string, fields: string[]){
    return fields.map((field: string) =>
        `${left}.${field} = ${rigth}.${field}`
    ).join(' and ');
}

export function sentenciaUpdate(definicion: BloqueVariablesGenerables, margen: number, defEst?: DefinicionEstructural, variablesDefinidas?: VariablesDefinidas): TextoSQL {
    var txtMargen = Array(margen + 1).join(' ');
    let tableDefEst = (defEst && defEst.tables && defEst.tables[definicion.tabla]) ? defEst.tables[definicion.tabla] : null;
    let defJoinExist: boolean = !!(definicion.joins && definicion.joins.length);
    let tablesToFromClausule: string[] = [];
    let completeWhereConditions: string = '';
    if (tableDefEst || defJoinExist) {
        let defJoinsWhere = defJoinExist ? definicion.joins.map(def => def.clausulaJoin).join(`\n    ${txtMargen}AND `) : '';
        completeWhereConditions = tableDefEst && defJoinExist ? `(${tableDefEst.where}) AND (${defJoinsWhere})` : tableDefEst ? tableDefEst.where : defJoinsWhere;
    }

    // se agregan prefijos a todas las variables de cada expresión validada
    if (variablesDefinidas){
        definicion.variables.forEach((v:VariableGenerable) => {
            if (v.insumos){
                prefijarExpresion(v, variablesDefinidas)
            }
        });
    }

    // resultado: se tienen todos los alias de todas las variables (se eliminan duplicados usando Set)
    //let aliasesUsados = [...(new Set([].concat(...(definicion.variables.filter(v => (v.insumos && v.insumos.aliases)).map(v => v.insumos.aliases)))))]; // borrar
    let aliasesUsados: {[key:string]:Set<string>} = {};
    
    definicion.variables.filter(v => (v.insumos && v.insumos.aliases)).forEach(vac => {
        vac.insumos.aliases.forEach(alias => {
            if(defEst && defEst.aliases && defEst.aliases[alias]){
                if (! aliasesUsados[alias]){
                    aliasesUsados[alias] = new Set();
                }
                vac.insumos.variables.forEach(varName => {
                    if (hasTablePrefix(varName) && varName.indexOf(alias) == 0 ) { // si está en la primera posición
                        aliasesUsados[alias].add(varName)
                    }
                })
            }
        })
    })

    let aliasLeftJoins = '';
    likear(aliasesUsados).forEach((aliasVars,aliasName) => {
        let alias = defEst.aliases[aliasName];
        let selectFieldsAlias=defEst.tables[alias.tabla_datos].pks.concat([...aliasVars]).join(', ');
        if (alias) {
            aliasLeftJoins +=
`
${txtMargen}      LEFT JOIN (
${txtMargen}          SELECT ${selectFieldsAlias}
${txtMargen}            FROM ${alias.tabla_datos} ${aliasName}`;
            aliasLeftJoins +=alias.where?
`
${txtMargen}            WHERE ${alias.where}`:'';
            aliasLeftJoins +=
`
${txtMargen}      ) ${aliasName} ON ${alias.on}`; 

        }
    });
    tablesToFromClausule = tablesToFromClausule.concat((tableDefEst && tableDefEst.sourceBro) ? tableDefEst.sourceBro + ' ' + tableDefEst.sourceJoin + aliasLeftJoins: []);
    tablesToFromClausule = tablesToFromClausule.concat(defJoinExist ? definicion.joins.map(def => def.tabla) : []);

    //saca duplicados de las tablas agregadas y devuelve un arreglo con solo el campo tabla_agregada
    let tablasAgregadas = [...(new Set(definicion.variables.filter(v => v.tabla_agregada).map(v => v.tabla_agregada)))];
    tablasAgregadas.forEach(tabAgg => {
        let vars = definicion.variables.filter(v => v.tabla_agregada == tabAgg);
        tablesToFromClausule = tablesToFromClausule.concat(
            `
${txtMargen}    LATERAL (
${txtMargen}      SELECT
${txtMargen}          ${vars.map(v => `${getAggregacion(v.funcion_agregacion, v.expresionValidada)} as ${v.nombreVariable}`).join(',\n          ' + txtMargen)}
${txtMargen}        FROM ${defEst.tables[tabAgg].sourceAgg}
${txtMargen}        WHERE ${defEst.tables[tabAgg].whereAgg[definicion.tabla]}
${txtMargen}    ) ${defEst.tables[tabAgg].aliasAgg}`
        );
    });

    return `${txtMargen}UPDATE ${tableDefEst ? tableDefEst.target : definicion.tabla}\n${txtMargen}  SET ` +
        definicion.variables.map(function (variable) {
            if (variable.tabla_agregada && variable.funcion_agregacion) {
                return `${variable.nombreVariable} = ${defEst.tables[variable.tabla_agregada].aliasAgg}.${variable.nombreVariable}`;
            } else {
                return `${variable.nombreVariable} = ${variable.expresionValidada}`;
            }
        }).join(`,\n      ${txtMargen}`) +
        (tablesToFromClausule.length ?
            `\n  ${txtMargen}FROM ${tablesToFromClausule.join(', ')}` +
            (completeWhereConditions ? `\n  ${txtMargen}WHERE ${completeWhereConditions}` : '')
            : '')
}

export function funcionGeneradora(definiciones: BloqueVariablesGenerables[], parametros: ParametrosGeneracion, defEst?: DefinicionEstructural, variablesDefinidas?: VariablesDefinidas): TextoSQL {
    return `CREATE OR REPLACE FUNCTION ${parametros.esquema}.${parametros.nombreFuncionGeneradora}() RETURNS TEXT
  LANGUAGE PLPGSQL
AS
$BODY$
BEGIN
`+
        definiciones.map(function (definicion) {
            return sentenciaUpdate(definicion, 2, defEst, variablesDefinidas) + ';'
        }).join('\n') + `
  RETURN 'OK';
END;
$BODY$;`;
}

export function getInsumos(expression: string): ExpresionParser.Insumos {
    return ExpresionParser.parse(expression).getInsumos();
}

export function getWrappedExpression(expression: string|number, pkExpression: string, options: ExpresionParser.CompilerOptions): string {
    var compiler = new ExpresionParser.Compiler(options);
    return compiler.toCode(ExpresionParser.parse(expression), pkExpression);
}

function hasTablePrefix(variable: string){
    return variable.match(/^.+\..+$/);
}

let checkInsumos = function (defVariable: DefinicionVariableAnalizada, vardef: string[], definicionesOrd: DefinicionVariableAnalizada[], nvardef: DefinicionVariableAnalizada[], defEst: DefinicionEstructural): boolean {
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

/**
 * @param nvardef son las que variables a calcular cuyos insumos no están en vardef
 * @param variablesDefinidas variables con insumos definidos
 */
export function separarEnGruposPorNivelYOrigen(nvardef: DefinicionVariableAnalizada[], variablesDefinidas: string[], defESt?: DefinicionEstructural): BloqueVariablesGenerables[] {
    var listaOut: BloqueVariablesGenerables[];
    listaOut = [];
    var lenAnt: number;
    var definicionesOrd: DefinicionVariableAnalizada[] = [];
    var compararJoins = function (joins1: Joins[], joins2: Joins[]) {
        return (joins1 === undefined && joins2 === undefined ||
            JSON.stringify(joins1) === JSON.stringify(joins2)) ? true : false;
    };
    var nuevoBloqueListaOut = function (defVariable: DefinicionVariableAnalizada): BloqueVariablesGenerables {
        var { tabla, joins, ...varAnalizada } = defVariable;
        var nuevo: BloqueVariablesGenerables = { tabla, variables: [varAnalizada] };
        if (joins !== undefined) {
            nuevo.joins = joins;
        }
        return nuevo;
    };
    do {
        lenAnt = nvardef.length;
        var i = 0;
        while (i < nvardef.length) {
            if (!checkInsumos(nvardef[i], variablesDefinidas, definicionesOrd, nvardef, defESt)) {
                i++;
            }
        };
    } while (nvardef.length > 0 && nvardef.length != lenAnt);
    if (nvardef.length > 0) {
        throw new Error("Error, no se pudo determinar el orden de la variable '" + nvardef[0].nombreVariable + "' y otras")
    }
    definicionesOrd.forEach(function (defVariable: DefinicionVariableAnalizada) {
        var { tabla, joins, ...varAnalizada } = defVariable;
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

// re-exports
export { Insumos } from 'expre-parser';
