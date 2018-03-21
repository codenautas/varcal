export declare type DefinicionVariable = {
    tabla: string;
    nombreVariable: string;
    expresionValidada: string;
};
export declare type ParametrosGeneracion = {
    nombreFuncionGeneradora: string;
    esquema: string;
};
export declare type DefinicionVariables = DefinicionVariable[];
export declare type TextoSQL = string;
export declare function funcionGeneradora(definiciones: DefinicionVariables, parametros: ParametrosGeneracion): TextoSQL;
