"use strict";

import * as ExpresionParser from 'expre-parser';

export interface DefinicionVariable {
    tabla: string
    nombreVariable: string
    expresionValidada: string
};

export interface Joins {
    tabla: string,
    clausulaJoin: string
};

export interface DefinicionVariableAnalizada extends DefinicionVariable {
    insumos: ExpresionParser.Insumos
    joins?: Joins[]
}

export interface VariableGenerable {
    nombreVariable: string
    expresionValidada: string
    funcion_agregacion?: 'contar' | 'sumar'
    tabla_agregada?: string
    insumos?: {
        variables?: string[]
        aliases?: string[]
        funciones?: string[]
    }
}

export type ParametrosGeneracion = {
    nombreFuncionGeneradora: string,
    esquema: string
}

export type DefinicionVariables = DefinicionVariable[];

export type TextoSQL = string;

export type BloqueVariablesGenerables = {
    tabla: string
    variables: VariableGenerable[]
    joins?: Joins[]
};

export type DefinicionEstructuralTabla = {
    target?: string
    sourceBro?: string
    sourceJoin?: string
    where?: string
    aliasAgg?: string
    sourceAgg?: string
    whereAgg?: string
}

export type DefinicionEstructural = {
    aliases?: Aliases
    tables: {
        [key: string]: DefinicionEstructuralTabla
    }
}

export interface Alias {
    tabla: string
    join: string
}

export interface Aliases {
    [key: string]: Alias 
}

//export type  ListaVariablesAnalizadasOut=ListaVariablesAnalizadas[];

function getAggregacion(f:string, exp:string){
    switch (f) {
        case 'sumar':
            return 'sum('+exp+')';
        case 'contar':
            return 'count(nullif('+exp+',false))';
        default:
            return f+'('+exp+')';
    }
}

export function sentenciaUpdate(definicion: BloqueVariablesGenerables, margen: number, defEst?: DefinicionEstructural): TextoSQL {
    var txtMargen = Array(margen + 1).join(' ');
    let tableDefEst = (defEst && defEst.tables && defEst.tables[definicion.tabla])? defEst.tables[definicion.tabla] : null;
    let defJoinExist:boolean = !!(definicion.joins && definicion.joins.length);
    let tablesToFromClausule: string[] = [];
    let completeWhereConditions: string = '';
    if (tableDefEst || defJoinExist) {
        let defJoinsWhere = defJoinExist? definicion.joins.map(def => def.clausulaJoin).join(`\n    ${txtMargen}AND `): '';
        completeWhereConditions = tableDefEst && defJoinExist ? `(${tableDefEst.where}) AND (${defJoinsWhere})` : tableDefEst ? tableDefEst.where : defJoinsWhere;
    }
    // resultado: se tienen todos los alias de todas las variables (se eliminan duplicados usando Set)
    let aliasesUsados = [...(new Set([].concat(...(definicion.variables.filter(v=>(v.insumos && v.insumos.aliases)).map(v=> v.insumos.aliases)))))];
    let aliasLeftJoins = '';
    aliasesUsados.forEach(aliasName => {
        let alias = defEst.aliases[aliasName];
        // LEFT JOIN personas padre ON (padre.id = personas.id AND padre.p0 = personas.p11)
        aliasLeftJoins +=
`
${txtMargen}    LEFT JOIN ${alias.tabla} ${aliasName} ON (${alias.join})
${txtMargen}    `;
    });
    tablesToFromClausule = tablesToFromClausule.concat((tableDefEst && tableDefEst.sourceBro)? tableDefEst.sourceBro + ' ' + aliasLeftJoins + tableDefEst.sourceJoin : []);
    tablesToFromClausule = tablesToFromClausule.concat(defJoinExist ? definicion.joins.map(def => def.tabla) : []);



    //saca duplicados de las tablas agregadas y devuelve un arreglo con solo el campo tabla_agregada
    let tablasAgregadas = [...(new Set(definicion.variables.filter(v=>v.tabla_agregada).map(v=> v.tabla_agregada)))];
    tablasAgregadas.forEach(tabAgg => {
        let vars = definicion.variables.filter(v => v.tabla_agregada == tabAgg);
        tablesToFromClausule = tablesToFromClausule.concat(
`
${txtMargen}    LATERAL (
${txtMargen}      SELECT
${txtMargen}          ${vars.map(v=> `${getAggregacion(v.funcion_agregacion,v.expresionValidada)} as ${v.nombreVariable}`).join(',\n          '+txtMargen)}
${txtMargen}        FROM ${defEst.tables[tabAgg].sourceAgg}
${txtMargen}        WHERE ${defEst.tables[tabAgg].whereAgg}
${txtMargen}    ) ${defEst.tables[tabAgg].aliasAgg}`
        );        
    });
    
    return `${txtMargen}UPDATE ${tableDefEst?tableDefEst.target:definicion.tabla}\n${txtMargen}  SET ` +
        definicion.variables.map(function (variable) {
            if (variable.tabla_agregada && variable.funcion_agregacion){
                return `${variable.nombreVariable} = ${defEst.tables[variable.tabla_agregada].aliasAgg}.${variable.nombreVariable}`;
            } else {
                return `${variable.nombreVariable} = ${variable.expresionValidada}`;
            }
        }).join(`,\n      ${txtMargen}`) +
        (tablesToFromClausule.length ?
            `\n  ${txtMargen}FROM ${tablesToFromClausule.join(', ')}` +
            (completeWhereConditions? `\n  ${txtMargen}WHERE ${completeWhereConditions}` : '')
            : '')
}

export function funcionGeneradora(definiciones: BloqueVariablesGenerables[], parametros: ParametrosGeneracion, defEst?: DefinicionEstructural): TextoSQL {
    return `CREATE OR REPLACE FUNCTION ${parametros.esquema}.${parametros.nombreFuncionGeneradora}() RETURNS TEXT
  LANGUAGE PLPGSQL
AS
$BODY$
BEGIN
`+
        definiciones.map(function (definicion) {
            return sentenciaUpdate(definicion, 2, defEst) + ';'
        }).join('\n') + `
  RETURN 'OK';
END;
$BODY$;`;
}

export function getInsumos(expression: string): ExpresionParser.Insumos {
    return ExpresionParser.parse(expression).getInsumos();
}

export function getWrappedExpression(expression: string, pkExpression:string, options:ExpresionParser.CompilerOptions):string {
    var compiler=new ExpresionParser.Compiler(options);
    return compiler.toCode(ExpresionParser.parse(expression),pkExpression);
}

let checkInsumos = function (defVariable: DefinicionVariableAnalizada, vardef: string[], definicionesOrd: DefinicionVariableAnalizada[], nvardef: DefinicionVariableAnalizada[], aliases: Aliases): boolean{
    var { nombreVariable, insumos } = defVariable;
    var cantDef: number=0;
    insumos.variables.forEach(function (varInsumos) {
        // si esta variable tiene un prefijo && la variable sin prefijo está definida && el prefijo está en la tabla de aliases
        if (varInsumos.match(/^.+\..+$/)){
            var [prefix, varName] = varInsumos.split('.');
            if (vardef.indexOf(varName) > -1 && (prefix in aliases)){
                vardef.push(varInsumos);// then agrego esta variable a vardef
            }
        }

        cantDef = vardef.indexOf(varInsumos) >= 0 ? cantDef + 1 : cantDef;
    });

    if(cantDef == insumos.variables.length) {
        vardef.push(nombreVariable);
        definicionesOrd.push(defVariable);
        if (nvardef.indexOf(defVariable) >= 0) {
            nvardef.splice(nvardef.indexOf(defVariable), 1)
        }
    }
    return cantDef == insumos.variables.length;
}

export function separarEnGruposPorNivelYOrigen(definiciones: DefinicionVariableAnalizada[], variablesDefinidas: string[], aliases?: Aliases): BloqueVariablesGenerables[] {
    var listaOut: BloqueVariablesGenerables[];
    listaOut = [];
    var vardef: string[]; //variables con insumos definidos
    vardef = variablesDefinidas;
    var nvardef: DefinicionVariableAnalizada[];
    nvardef = definiciones; // son las que variables cuyos insumos no están en vardef.
    var lenAnt: number;
    var definicionesOrd: DefinicionVariableAnalizada[] = [];

    var compararJoins = function (joins1: Joins[], joins2: Joins[]) {
        return (joins1 === undefined && joins2 === undefined ||
            JSON.stringify(joins1) === JSON.stringify(joins2)) ? true : false;
    };

    var nuevoBloqueListaOut = function (defVariable: DefinicionVariableAnalizada): BloqueVariablesGenerables {
        var { tabla, joins, ...varAnalizada } = defVariable;
        var nuevo: BloqueVariablesGenerables = { tabla, variables: [varAnalizada] };
        if (joins !== undefined) {
            nuevo.joins = joins;
        }
        return nuevo;
    };
 
    do {
        lenAnt = nvardef.length;
        var i = 0;
        while (i < nvardef.length) {
            if(!checkInsumos(nvardef[i], vardef,definicionesOrd, nvardef, aliases)){
                i++;
            }
        };
    } while (nvardef.length > 0 && nvardef.length != lenAnt);
    if (nvardef.length > 0) {
        throw new Error("Error, no se pudo determinar el orden de la variable '" + nvardef[0].nombreVariable + "' y otras")
    }
    definicionesOrd.forEach(function (defVariable: DefinicionVariableAnalizada) {
        var { tabla, joins, ...varAnalizada } = defVariable;
        if (listaOut.length == 0) {
            listaOut.push(nuevoBloqueListaOut(defVariable));
            //listaOut.push({tabla ,variables:[varAnalizada]});
            // listaOut[0]=setJoins(listaOut[0],joins);
        } else {
            var enNivel = defVariable.insumos.variables.length?defVariable.insumos.variables.map(function (varInsumo) {
                return listaOut.findIndex(function (nivel) {
                    return nivel.variables.findIndex(function (vvar) {
                        return vvar.nombreVariable == varInsumo
                    }) == -1 ? false : true
                })
            }).reduce(function (elem: number, anterior: number) {
                return elem > anterior ? elem : anterior;
            }):0;
            if (enNivel >= 0 && listaOut.length === enNivel + 1) {
                listaOut.push(nuevoBloqueListaOut(defVariable));
                //listaOut.push({tabla ,variables:[varAnalizada]});
                //listaOut[listaOut.length-1]=setJoins(listaOut[listaOut.length-1],joins);
            } else {
                var nivelTabla = listaOut[enNivel + 1].tabla == tabla && compararJoins(listaOut[enNivel + 1].joins, joins) ? enNivel + 1 : listaOut.findIndex(function (nivel, i) {
                    return nivel.tabla == tabla && compararJoins(nivel.joins, joins) && i > enNivel + 1
                });
                if (nivelTabla >= 0) {
                    listaOut[nivelTabla].variables.push(varAnalizada);
                } else {
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

// re-exports
export {Insumos} from 'expre-parser';