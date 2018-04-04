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

export interface VariableGenerable{
    nombreVariable:string
    expresionValidada:string
    insumos?:{
        variables:string[]
        funciones:string[]
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
    variables: VariableGenerable[]
};

//export type  ListaVariablesAnalizadasOut=ListaVariablesAnalizadas[];

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

export function calcularNiveles(definiciones:BloqueVariablesGenerables):BloqueVariablesGenerables[]{
    /*versión preliminar es sólo una idea y falta terminarla*/
    //console.log('****'+definiciones);
    var listaOut: BloqueVariablesGenerables[];
    listaOut=[];
    definiciones.variables.forEach(function(varAnalizada:VariableGenerable) {
        if (listaOut.length==0){
            listaOut.push({tabla:definiciones.tabla,variables:[varAnalizada]});    
        }else{
            var enNivel=listaOut.findIndex(function(nivel){
                //velem.nombreVariable==varAnalizada.nombreVariable
                return varAnalizada.insumos.variables.findIndex(function(vvar,i){
                        return nivel.variables[i].nombreVariable==vvar;
                })===-1?false:true;        
            }); 
            if(enNivel>=0 && listaOut.length===enNivel+1 ){
                listaOut.push({tabla:definiciones.tabla,variables:[varAnalizada]});
            }else if(enNivel>=0 && listaOut.length>enNivel){
                    listaOut[enNivel+1].variables.push(varAnalizada);
            }else{
                listaOut[0].variables.push(varAnalizada);
            }   
        }    
    });
return listaOut;
}