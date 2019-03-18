"use strict";

import * as ExpresionParser from 'expre-parser';
import { VariableCalculada } from './types-varcal';
import { hasAlias } from 'operativos';
import { VarCalculator } from './var-calculator';


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

// export class BloqueVariablesACalcular {
//     tabla: string
//     variables: VariableCalculada[]

//     constructor(vCalc: VariableCalculada) {
//         this.tabla = vCalc.tabla_datos;
//         this.variables = [vCalc];
//     }
// };
// export type DefinicionEstructuralTabla = {
//     operativo?: string;
//     target?: string;
//     sourceBro?: string;
//     pks?: string[];
//     sourceJoin?: string;
//     where?: string;
//     aliasAgg?: string;
//     sourceAgg?: string;
//     whereAgg?: {
//         [key: string]: string
//     }
// };

// export type Tables = {
//     [key: string]: DefinicionEstructuralTabla
// }

// export type DefinicionEstructural = {
//     aliases?: Aliases
//     tables: Tables
// }

export interface Aliases {
    [key: string]: AliasDefEst
}


