import * as ExpresionParser from 'expre-parser';
import * as typesVarcal from "./types-varcal";
export declare const sufijo_tabla_calculada: string;
export declare const sufijo_agregacion: string;
export { CompilerOptions } from 'expre-parser';
export interface DefinicionVariable {
    tabla: string;
    nombreVariable: string;
    expresionValidada: string;
}
export interface Joins {
    tabla: string;
    clausulaJoin: string;
}
export interface DefinicionVariableAnalizada extends DefinicionVariable {
    insumos: ExpresionParser.Insumos;
    joins?: Joins[];
}
export interface VariableGenerable {
    nombreVariable: string;
    expresionValidada: string;
    funcion_agregacion?: 'contar' | 'sumar';
    tabla_agregada?: string;
    insumos?: {
        variables?: string[];
        aliases?: string[];
        funciones?: string[];
    };
}
export declare type ParametrosGeneracion = {
    nombreFuncionGeneradora: string;
    esquema: string;
};
export declare type TextoSQL = string;
export declare type BloqueVariablesGenerables = {
    tabla: string;
    variables: VariableGenerable[];
    joins?: Joins[];
};
export declare type DefinicionEstructuralTabla = {
    target?: string;
    sourceBro?: string;
    pkString?: string;
    sourceJoin?: string;
    where?: string;
    aliasAgg?: string;
    sourceAgg?: string;
    whereAgg?: {
        [key: string]: string;
    };
    detailTables?: typesVarcal.DetailTable[];
};
export declare type Tables = {
    [key: string]: DefinicionEstructuralTabla;
};
export declare type DefinicionEstructural = {
    aliases?: Aliases;
    tables: Tables;
};
export interface VariableDefinida {
    tabla: string;
    clase?: string;
}
export interface VariablesDefinidas {
    [key: string]: VariableDefinida;
}
export interface Aliases {
    [key: string]: typesVarcal.AliasDefEst;
}
export declare function sentenciaUpdate(definicion: BloqueVariablesGenerables, margen: number, defEst?: DefinicionEstructural, variablesDefinidas?: VariablesDefinidas): TextoSQL;
export declare function funcionGeneradora(definiciones: BloqueVariablesGenerables[], parametros: ParametrosGeneracion, defEst?: DefinicionEstructural, variablesDefinidas?: VariablesDefinidas): TextoSQL;
export declare function getInsumos(expression: string): ExpresionParser.Insumos;
export declare function getWrappedExpression(expression: string | number, pkExpression: string, options: ExpresionParser.CompilerOptions): string;
/**
 * @param nvardef son las que variables a calcular cuyos insumos no están en vardef
 * @param variablesDefinidas variables con insumos definidos
 */
export declare function separarEnGruposPorNivelYOrigen(nvardef: DefinicionVariableAnalizada[], variablesDefinidas: string[], defESt?: DefinicionEstructural): BloqueVariablesGenerables[];
export { Insumos } from 'expre-parser';
