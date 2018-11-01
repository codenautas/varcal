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
