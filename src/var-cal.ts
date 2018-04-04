"use strict";

export interface DefinicionVariable{
    tabla:string
    nombreVariable:string
    expresionValidada:string
};

export interface Joins{
    tabla:string,
    clausulaJoin:string
};

export interface DefinicionVariableAnalizada extends DefinicionVariable{
    insumos:{
        variables:string[],
        funciones:string[],
    },
    joins?:Joins[]
}

export interface VariableGenerable{
    nombreVariable:string
    expresionValidada:string
    insumos?:{
        variables?:string[]
        funciones?:string[]
    }
}

export type ParametrosGeneracion={
    nombreFuncionGeneradora:string, 
    esquema:string
}

export type DefinicionVariables=DefinicionVariable[];

export type TextoSQL=string;

export type  BloqueVariablesGenerables={
    tabla:string,
    variables: VariableGenerable[],
    joins?:Joins[]
};

//export type  ListaVariablesAnalizadasOut=ListaVariablesAnalizadas[];

export function sentenciaUpdate(definicion:BloqueVariablesGenerables, margen:number):TextoSQL{
    var txtMargen=Array(margen+1).join(' ');
    return `${txtMargen}UPDATE ${definicion.tabla}\n${txtMargen}  SET `+
        definicion.variables.map(function({nombreVariable,expresionValidada}){
            return `${nombreVariable} = ${expresionValidada}`
        }).join(`,\n      ${txtMargen}`)+
        (definicion.joins && definicion.joins.length?
            `\n  ${txtMargen}FROM `+definicion.joins.map(def=>def.tabla).join(', ')+
            `\n  ${txtMargen}WHERE `+definicion.joins.map(def=>def.clausulaJoin).join(`\n    ${txtMargen}AND `)
        :'')
        ;
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

export function laMisma(varAnalizada:DefinicionVariable){
    return varAnalizada;
}

export function separarEnGruposPorNivelYOrigen(definiciones:DefinicionVariableAnalizada[], variablesDefinidas:string[]):BloqueVariablesGenerables[]{
    var listaOut: BloqueVariablesGenerables[];
    listaOut=[];
    definiciones.forEach(function(defVariable:DefinicionVariableAnalizada) {
        var {tabla, ...varAnalizada} = defVariable;
        if (listaOut.length==0){
            listaOut.push({tabla ,variables:[varAnalizada]});    
        }else{
            var enNivel=listaOut.findIndex(function(nivel){
                return defVariable.insumos.variables.findIndex(function(vvar,i){
                    return nivel.variables[i].nombreVariable==vvar;
                })===-1?false:true;
            }); 
            if(enNivel>=0 && listaOut.length===enNivel+1 ){
                listaOut.push({tabla ,variables:[varAnalizada]});
            }else if(enNivel>=0 && listaOut.length>enNivel){
                listaOut[enNivel+1].variables.push(varAnalizada);
            }else{
                listaOut[0].variables.push(varAnalizada);
            }   
        }    
    });
    return listaOut;
}