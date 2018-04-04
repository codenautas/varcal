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
    insumos: {
        variables: string[];
        funciones: string[];
    };
    joins?: Joins[];
}
export interface VariableGenerable {
    nombreVariable: string;
    expresionValidada: string;
    insumos?: {
        variables?: string[];
        funciones?: string[];
    };
}
export declare type ParametrosGeneracion = {
    nombreFuncionGeneradora: string;
    esquema: string;
};
export declare type DefinicionVariables = DefinicionVariable[];
export declare type TextoSQL = string;
export declare type BloqueVariablesGenerables = {
    tabla: string;
    variables: VariableGenerable[];
    joins?: Joins[];
};
export declare function sentenciaUpdate(definicion: BloqueVariablesGenerables, margen: number): TextoSQL;
export declare function funcionGeneradora(definiciones: BloqueVariablesGenerables[], parametros: ParametrosGeneracion): TextoSQL;
export declare function laMisma(varAnalizada: DefinicionVariable): DefinicionVariable;
export declare function separarEnGruposPorNivelYOrigen(definiciones: DefinicionVariableAnalizada[], variablesDefinidas: string[]): BloqueVariablesGenerables[];
