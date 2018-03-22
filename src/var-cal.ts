"use strict";

export interface DefinicionVariable{
    tabla:string
    nombreVariable:string
    expresion:string
};

export interface DefinicionVariableAnalizada extends DefinicionVariable{
    insumos:{
        variables:string[],
        funciones:string[],
    }
}

export interface BloqueVariablesGenerables{
    tabla:string
    variables:[{
        nombreVariable:string
        expresionValidada:string
    }]
}

export type ParametrosGeneracion={
    nombreFuncionGeneradora:string, 
    esquema:string
}

export type DefinicionVariables=DefinicionVariable[];

export type TextoSQL=string;

export function sentenciaUpdate(definicion:BloqueVariablesGenerables, parametros:ParametrosGeneracion):TextoSQL{
}

export function funcionGeneradora(definiciones:BloqueVariablesGenerables[], parametros:ParametrosGeneracion):TextoSQL{
    return `create or replace function ${parametros.esquema}.${parametros.nombreFuncionGeneradora}() returns text
  language plpgsql
as
$BODY$
begin`+
definiciones.map(function(definicion){
    return `
  update ${definicion.tabla} set ${definicion.nombreVariable} = ${definicion.expresionValidada};`;
})+`
  RETURN 'OK';
end;
$BODY$;`;
}