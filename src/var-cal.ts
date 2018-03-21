"use strict";

export type DefinicionVariable={
    tabla:string
    nombreVariable:string
    expresionValidada:string
};

export type ParametrosGeneracion={
    nombreFuncionGeneradora:string, 
    esquema:string
}

export type DefinicionVariables=DefinicionVariable[];

export type TextoSQL=string;

export function funcionGeneradora(definiciones:DefinicionVariables, parametros:ParametrosGeneracion):TextoSQL{
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