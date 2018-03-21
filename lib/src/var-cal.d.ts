export declare type DefinicionVariable = {
    nombreVariable: string;
    expresionValidada: string;
};
export declare type DefinicionVariables = DefinicionVariable[];
export declare type TextoSQL = string;
export declare function funcionGeneradora(definiciones: DefinicionVariables, parametros: {
    nombreFuncionGeneradora: string;
}): TextoSQL;
