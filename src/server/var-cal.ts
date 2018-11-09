"use strict";

import * as ExpresionParser from 'expre-parser';
import { VariableCalculada } from './types-varcal';
import { hasTablePrefix } from 'operativos';


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

export function getInsumos(expression: string): ExpresionParser.Insumos {
    return ExpresionParser.parse(expression).getInsumos();
}

export function getWrappedExpression(expression: string | number, pkExpression: string, options: ExpresionParser.CompilerOptions): string {
    var compiler = new ExpresionParser.Compiler(options);
    return compiler.toCode(ExpresionParser.parse(expression), pkExpression);
}

export const sufijo_agregacion: string = '_agg';






// Se reactiva codigo antiguo para de separarGruposPorOirgenYNivel 
// para testear > debuguear > documentar > modularizar > refactorizar > llevar al modelo lo que sirva

export interface AliasDefEst {
    on: string
    tabla_datos: string
    where?: string
}

export interface Alias extends AliasDefEst {
    operativo: string
    alias: string
    descripcion?: string
}

export type PrefixedPks = { [key: string]: { pks: string[], pksString: string } };

export interface Join {
    tabla: string,
    clausulaJoin: string
};

// export interface VariableGenerable{
//     tabla?: string
//     nombreVariable: string
//     expresionValidada: string
//     funcion_agregacion?: 'contar' | 'sumar' | 'promediar'
//     tabla_agregada?: string
//     insumos?: ExpresionParser.Insumos
//     aliases?: Aliases
// }

export type TextoSQL = string;

export class BloqueVariablesACalcular {
    tabla: string
    variables: VariableCalculada[]

    constructor(vCalc: VariableCalculada) {
        this.tabla = vCalc.tabla_datos;
        this.variables = [vCalc];
    }
};
export type DefinicionEstructuralTabla = {
    operativo?: string;
    target?: string;
    sourceBro?: string;
    pks?: string[];
    sourceJoin?: string;
    where?: string;
    aliasAgg?: string;
    sourceAgg?: string;
    whereAgg?: {
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

export interface Aliases {
    [key: string]: AliasDefEst
}

function checkInsumos(vCalc: VariableCalculada, definedVars: string[], defEst: DefinicionEstructural): boolean {
    var countChecked: number = 0;
    vCalc.insumos.variables.forEach(
        varInsumos => countChecked = checkAndPushVar(varInsumos, definedVars, defEst)? countChecked + 1 : countChecked);
    // están todas las insumosVars definidas si se cumple la igualdad
    return countChecked == vCalc.insumos.variables.length;
}

function checkAndPushVar(varInsumosName: string, definedVars: string[], defEst: DefinicionEstructural,) {
    let varChecked = definedVars.indexOf(varInsumosName) >= 0;
    if (!varChecked && insumoVarIsWellPrefixed(varInsumosName, definedVars, defEst)) {
        definedVars.push(varInsumosName);
        varChecked = true;
    }
    // si la variable de insumo estaba definida previamente o porque se acaba de agregar al array 
    return varChecked;
}

function insumoVarIsWellPrefixed(varInsumosName: string, definedVars: string[], defEst: DefinicionEstructural) {
    // si esta variable tiene un prefijo && la variable sin prefijo está definida && el prefijo está en la tabla de aliases
    let isDefined = false;
    if (hasTablePrefix(varInsumosName) && defEst) {
        var [prefix, varName] = varInsumosName.split('.')
        if (definedVars.indexOf(varName) > -1 && (prefix in { ...defEst.tables, ...defEst.aliases })) {
            isDefined = true
        }
    }
    return isDefined;
}

/**
 * @param nonDefinedVars son las que variables a calcular cuyos insumos no están en definedVars
 * @param definedVars variables con insumos definidos
 */
export function separarEnGruposPorNivelYOrigen(nonDefinedVars: VariableCalculada[], definedVars: string[], defEst?: DefinicionEstructural): BloqueVariablesACalcular[] {
    var orderedCalcVars: VariableCalculada[] = sortCalcVariablesByDependency(nonDefinedVars, definedVars, defEst);
    return separarEnGrupos(orderedCalcVars);
}

export function separarEnGrupos(orderedCalcVars: VariableCalculada[]) {
    let listaOut: BloqueVariablesACalcular[] = [];
    orderedCalcVars.forEach(function (vCalc: VariableCalculada) {
        if (listaOut.length == 0) {
            listaOut.push(new BloqueVariablesACalcular(vCalc));
        }
        else {
            var enNivel = vCalc.insumos.variables.length ? vCalc.insumos.variables.map(function (varInsumo) {
                return listaOut.findIndex(function (nivel) {
                    return nivel.variables.findIndex(function (vvar) {
                        return vvar.variable == varInsumo;
                    }) == -1 ? false : true;
                });
            }).reduce(function (elem: number, anterior: number) {
                return elem > anterior ? elem : anterior;
            }) : 0;
            if (enNivel >= 0 && listaOut.length === enNivel + 1) {
                listaOut.push(new BloqueVariablesACalcular(vCalc));
            }
            else {
                let tabla = vCalc.tabla_datos;
                var nivelTabla = listaOut[enNivel + 1].tabla == tabla ? enNivel + 1 : listaOut.findIndex(function (nivel, i) {
                    return nivel.tabla == tabla && i > enNivel + 1;
                });
                if (nivelTabla >= 0) {
                    listaOut[nivelTabla].variables.push(vCalc);
                }
                else {
                    listaOut.push(new BloqueVariablesACalcular(vCalc));
                }
            }
        }
    });
    return listaOut;
}

export function sortCalcVariablesByDependency(nonDefinedVars: VariableCalculada[], definedVars: string[], defEst: DefinicionEstructural) {
    var orderedCalcVars: VariableCalculada[] = [];
    var prevNonDefVarsLength: number;
    do {
        prevNonDefVarsLength = nonDefinedVars.length;
        findNewDefinedVars(nonDefinedVars, definedVars, defEst, orderedCalcVars);
    } while (nonDefinedVars.length > 0 && nonDefinedVars.length != prevNonDefVarsLength);
    if (nonDefinedVars.length > 0) {
        throw new Error("Error, no se pudo determinar el orden de la variable '" + nonDefinedVars[0].variable + "' y otras");
    }
    return orderedCalcVars;
}
function findNewDefinedVars(nonDefinedVars: VariableCalculada[], definedVars: string[], defEst: DefinicionEstructural, orderedCalcVars: VariableCalculada[]) {
    var i = 0;
    while (i < nonDefinedVars.length) {
        let vCalc = nonDefinedVars[i];
        // si todas las variables de insumo de una varCalc están definidas,
        if (checkInsumos(vCalc, definedVars, defEst)) {
            // entonces se agrega la variable en cuestión como definida y se elimina de la lista de no definidas
            definedVars.push(vCalc.variable);
            orderedCalcVars.push(vCalc);
            nonDefinedVars.splice(i, 1);
        }
        else {
            i++;
        }
    }
}

