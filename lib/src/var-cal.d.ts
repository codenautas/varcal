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
export interface VariableGenerable {
    nombreVariable: string;
    expresionValidada: string;
    insumos?: {
        variables: string[];
        funciones: string[];
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
};
export declare function sentenciaUpdate(definicion: BloqueVariablesGenerables, margen: number): TextoSQL;
export declare function funcionGeneradora(definiciones: BloqueVariablesGenerables[], parametros: ParametrosGeneracion): TextoSQL;
export declare function calcularNiveles(definiciones: BloqueVariablesGenerables): BloqueVariablesGenerables[];
