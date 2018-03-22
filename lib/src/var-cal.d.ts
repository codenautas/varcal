export interface DefinicionVariable {
    tabla: string;
    nombreVariable: string;
    expresion: string;
}
export interface DefinicionVariableAnalizada extends DefinicionVariable {
    insumos: {
        variables: string[];
        funciones: string[];
    };
}
export interface BloqueVariablesGenerables {
    tabla: string;
    variables: {
        nombreVariable: string;
        expresionValidada: string;
    }[];
}
export declare type ParametrosGeneracion = {
    nombreFuncionGeneradora: string;
    esquema: string;
};
export declare type DefinicionVariables = DefinicionVariable[];
export declare type TextoSQL = string;
export declare function sentenciaUpdate(definicion: BloqueVariablesGenerables, margen: number): TextoSQL;
export declare function funcionGeneradora(definiciones: BloqueVariablesGenerables[], parametros: ParametrosGeneracion): TextoSQL;
