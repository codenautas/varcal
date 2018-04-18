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
    var vardef: string[]; //variables con insumos definidos
    vardef=variablesDefinidas;
    var nvardef: DefinicionVariableAnalizada[];
    nvardef=[]; // son las que variables cuyos insumos no están en vardef.
    var lenAnt:number;
    var definicionesOrd:DefinicionVariableAnalizada[]=[];

    var compararJoins=function(joins1:Joins[],joins2:Joins[] ){
        return (joins1===undefined && joins2===undefined ||
             JSON.stringify(joins1)===JSON.stringify(joins2))?true:false;
    } ;

    var nuevoBloqueListaOut=function(defVariable:DefinicionVariableAnalizada ): BloqueVariablesGenerables {
        var {tabla,joins,...varAnalizada} = defVariable;
        var nuevo:BloqueVariablesGenerables={tabla ,variables:[varAnalizada]};
        if(joins !==undefined){
            nuevo.joins=joins;
        }
        return nuevo;
    };    

    definiciones.forEach(function(defVariable:DefinicionVariableAnalizada) {
        var {tabla,nombreVariable,insumos, ...varAnalizada} = defVariable;
        var cantDef=0;
        insumos.variables.forEach(function(varInsumos){
            cantDef=vardef.indexOf(varInsumos)>=0?cantDef +1:cantDef;
        });
        if(cantDef==insumos.variables.length){
            vardef.push(nombreVariable);
            definicionesOrd.push(defVariable);
            if (nvardef.indexOf(defVariable)>=0){
                nvardef.splice(nvardef.indexOf(defVariable),1)
            }
        }else{
            if(nvardef.findIndex(function(varNvardef){return varNvardef.nombreVariable==nombreVariable})==-1){ 
                nvardef.push(defVariable);
            }
        }
    });
    do {
        lenAnt=nvardef.length;
        var i=0;
        while(i<nvardef.length) {
            var defVariable:DefinicionVariableAnalizada=nvardef[i];
            var {tabla,nombreVariable,insumos, ...varAnalizada} = defVariable;
            var cantDef=0;
            insumos.variables.forEach(function(varInsumos){
                cantDef=vardef.indexOf(varInsumos)>=0?cantDef +1:cantDef;
            });
            if(cantDef==insumos.variables.length){
                vardef.push(nombreVariable);
                definicionesOrd.push(defVariable);
                nvardef.splice(i,1);
            }else{
                i++;
            }    
        };
   }while(nvardef.length>0 && nvardef.length!=lenAnt );
    if( nvardef.length >0){
        throw new Error("Error, no se pudo determinar el orden de la variable '" + nvardef[0].nombreVariable +"' y otras")
    } 
    definicionesOrd.forEach(function(defVariable:DefinicionVariableAnalizada) {
        var {tabla,joins,...varAnalizada} = defVariable;
        if (listaOut.length==0){
            listaOut.push(nuevoBloqueListaOut(defVariable));
            //listaOut.push({tabla ,variables:[varAnalizada]});
           // listaOut[0]=setJoins(listaOut[0],joins);
        }else{
            var enNivel=defVariable.insumos.variables.map(function(varInsumo){
                return listaOut.findIndex(function(nivel){
                    return nivel.variables.findIndex(function(vvar){
                        return vvar.nombreVariable==varInsumo
                    })==-1?false:true
                })  
            }).reduce(function(elem:number, anterior:number){
                return elem>anterior? elem:anterior;
            });
            if(enNivel>=0 && listaOut.length===enNivel+1 ){
                listaOut.push(nuevoBloqueListaOut(defVariable));
                //listaOut.push({tabla ,variables:[varAnalizada]});
                //listaOut[listaOut.length-1]=setJoins(listaOut[listaOut.length-1],joins);
            }else {
                var nivelTabla=listaOut[enNivel+1].tabla==tabla && compararJoins(listaOut[enNivel+1].joins,joins)?enNivel+1:listaOut.findIndex(function(nivel,i){
                        return nivel.tabla==tabla && compararJoins(nivel.joins,joins) && i>enNivel+1
                });
                if(nivelTabla>=0){
                    listaOut[nivelTabla].variables.push(varAnalizada);
                }else{
                    listaOut.push(nuevoBloqueListaOut(defVariable));
                    //listaOut.push({tabla ,variables:[varAnalizada]});
                    //listaOut[listaOut.length-1]=setJoins(listaOut[listaOut.length-1],joins);
                }
            }
        }
    });
    console.log(JSON.stringify(listaOut));
    return listaOut;
}