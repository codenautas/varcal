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
    variables:{
        nombreVariable:string
        expresionValidada:string
    }[]
}

export type ParametrosGeneracion={
    nombreFuncionGeneradora:string, 
    esquema:string
}

export type DefinicionVariables=DefinicionVariable[];

export type TextoSQL=string;

export type  ListaVariablesAnalizadas=DefinicionVariableAnalizada[];

export type  ListaVariablesAnalizadasOut=ListaVariablesAnalizadas[];

export function sentenciaUpdate(definicion:BloqueVariablesGenerables, margen:number):TextoSQL{
    var txtMargen=Array(margen+1).join(' ');
    return `${txtMargen}UPDATE ${definicion.tabla}\n${txtMargen}  SET `+
        definicion.variables.map(function({nombreVariable,expresionValidada}){
            return `${nombreVariable} = ${expresionValidada}`
        }).join(`,\n      ${txtMargen}`);
}

export function funcionGeneradora(definiciones:BloqueVariablesGenerables[], parametros:ParametrosGeneracion):TextoSQL{
    return `CREATE OR REPLACE FUNCTION ${parametros.esquema}.${parametros.nombreFuncionGeneradora}() RETURNS TEXT
  LANGUAGE PLPGSQL
AS
$BODY$
BEGIN
`+
definiciones.map(function(definicion){
    return sentenciaUpdate(definicion, 2)+';'
}).join('\n')+`
  RETURN 'OK';
END;
$BODY$;`;
}

export function calcularNiveles(definiciones:ListaVariablesAnalizadas):ListaVariablesAnalizadasOut{
    /*versión preliminar es sólo una idea y falta terminarla*/
    var listaOut: ListaVariablesAnalizadasOut;
    listaOut=[];
    definiciones.forEach(function(varAnalizada) {
        if (listaOut===[]){
            listaOut.push([varAnalizada]);    
        }else{
            listaOut.forEach(function(listaNivel,i){
                /*var estanivel=*/listaNivel.filter(function(velem){
                    //velem.nombreVariable==varAnalizada.nombreVariable
                    varAnalizada.insumos.variables.find(function(vvar){
                         return velem.nombreVariable==vvar;
                    });        
                });    
            });
        }    
    });
return listaOut;
}