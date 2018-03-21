"use strict";

export type DefinicionVariable={
    nombreVariable:string
    expresionValidada:string
};

export type DefinicionVariables=DefinicionVariable[];

export type TextoSQL=string;

export function funcionGeneradora(definiciones:DefinicionVariables, parametros:{nombreFuncionGeneradora:string}):TextoSQL{
    return "create function "+parametros.nombreFuncionGeneradora+"("+definiciones+")";
}