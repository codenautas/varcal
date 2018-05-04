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
    tabla: string,
    variables: VariableGenerable[],
    joins?: Joins[]
};

export type DefinicionEstructuralTabla = {
    target: string
    sourceBro?: string
    sourceJoin: string
    where: string
}

export type DefinicionEstructural = {
    tables: {
        [key: string]: DefinicionEstructuralTabla
    }
}

//export type  ListaVariablesAnalizadasOut=ListaVariablesAnalizadas[];

export function sentenciaUpdate(definicion: BloqueVariablesGenerables, margen: number, defEst?: DefinicionEstructural): TextoSQL {
    var txtMargen = Array(margen + 1).join(' ');
    let tableDefEst = (defEst && defEst.tables && defEst.tables[definicion.tabla])? defEst.tables[definicion.tabla] : null;
    let defJoinExist:boolean = !!(definicion.joins && definicion.joins.length);
    let tablesToFromClausule: string[] = [];
    let completeWhereConditions: string = '';
    if (tableDefEst || defJoinExist) {
        let defJoinsWhere = defJoinExist? definicion.joins.map(def => def.clausulaJoin).join(`\n    ${txtMargen}AND `): '';
        completeWhereConditions = tableDefEst && defJoinExist ? `(${tableDefEst.where}) AND (${defJoinsWhere})` : tableDefEst ? tableDefEst.where : defJoinsWhere;
        tablesToFromClausule = [].concat(tableDefEst ? tableDefEst.sourceJoin : [], defJoinExist ? definicion.joins.map(def => def.tabla) : []);
    }
    
    return `${txtMargen}UPDATE ${tableDefEst?tableDefEst.target:definicion.tabla}\n${txtMargen}  SET ` +
        definicion.variables.map(function ({ nombreVariable, expresionValidada }) {
            return `${nombreVariable} = ${expresionValidada}`
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

export function separarEnGruposPorNivelYOrigen(definiciones: DefinicionVariableAnalizada[], variablesDefinidas: string[]): BloqueVariablesGenerables[] {
    var listaOut: BloqueVariablesGenerables[];
    listaOut = [];
    var vardef: string[]; //variables con insumos definidos
    vardef = variablesDefinidas;
    var nvardef: DefinicionVariableAnalizada[];
    nvardef = []; // son las que variables cuyos insumos no están en vardef.
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
    // defConInsumos=definiciones.map(function(defVariable){
    //    if insumos not in defVariable

    //});
    definiciones.forEach(function (defVariable: DefinicionVariableAnalizada) {
        var { tabla, nombreVariable, insumos, ...varAnalizada } = defVariable;
        var cantDef = 0;
        insumos.variables.forEach(function (varInsumos) {
            cantDef = vardef.indexOf(varInsumos) >= 0 ? cantDef + 1 : cantDef;
        });
        if (cantDef == insumos.variables.length) {
            vardef.push(nombreVariable);
            definicionesOrd.push(defVariable);
            if (nvardef.indexOf(defVariable) >= 0) {
                nvardef.splice(nvardef.indexOf(defVariable), 1)
            }
        } else {
            if (nvardef.findIndex(function (varNvardef) { return varNvardef.nombreVariable == nombreVariable }) == -1) {
                nvardef.push(defVariable);
            }
        }
    });
    do {
        lenAnt = nvardef.length;
        var i = 0;
        while (i < nvardef.length) {
            var defVariable: DefinicionVariableAnalizada = nvardef[i];
            var { tabla, nombreVariable, insumos, ...varAnalizada } = defVariable;
            var cantDef = 0;
            insumos.variables.forEach(function (varInsumos) {
                cantDef = vardef.indexOf(varInsumos) >= 0 ? cantDef + 1 : cantDef;
            });
            if (cantDef == insumos.variables.length) {
                vardef.push(nombreVariable);
                definicionesOrd.push(defVariable);
                nvardef.splice(i, 1);
            } else {
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
            var enNivel = defVariable.insumos.variables.map(function (varInsumo) {
                return listaOut.findIndex(function (nivel) {
                    return nivel.variables.findIndex(function (vvar) {
                        return vvar.nombreVariable == varInsumo
                    }) == -1 ? false : true
                })
            }).reduce(function (elem: number, anterior: number) {
                return elem > anterior ? elem : anterior;
            });
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