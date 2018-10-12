"use strict";

import * as ExpresionParser from 'expre-parser';
import { CompilerOptions } from 'expre-parser';
import * as likear from 'like-ar';
import { VariableOpcion } from 'operativos';
import { BloqueVariablesGenerables, DefinicionEstructural, Join, ParametrosGeneracion, PrefixedPks, TextoSQL, VariableComplete, VariableGenerable, VariablesDefinidas, DefinicionEstructuralTabla } from "./types-varcal";
import { AppVarCal } from './app-varcal';


function hasTablePrefix(variable: string){
    return variable.match(/^.+\..+$/);
}

function checkInsumos(defVariable: VariableGenerable, vardef: string[], definicionesOrd: VariableGenerable[], nvardef: VariableGenerable[], defEst: DefinicionEstructural): boolean {
    var { nombreVariable, insumos } = defVariable;
    var cantDef: number = 0;
    insumos.variables.forEach(function (varInsumos) {
        // si esta variable tiene un prefijo && la variable sin prefijo está definida && el prefijo está en la tabla de aliases
        if (hasTablePrefix(varInsumos) && defEst) {
            var [prefix, varName] = varInsumos.split('.');
            if (vardef.indexOf(varName) > -1 && (prefix in { ...defEst.tables, ...defEst.aliases })) {
                vardef.push(varInsumos);// then agrego esta variable a vardef
            }
        }
        cantDef = vardef.indexOf(varInsumos) >= 0 ? cantDef + 1 : cantDef;
    });
    if (cantDef == insumos.variables.length) {
        vardef.push(nombreVariable);
        definicionesOrd.push(defVariable);
        if (nvardef.indexOf(defVariable) >= 0) {
            nvardef.splice(nvardef.indexOf(defVariable), 1)
        }
    }
    return cantDef == insumos.variables.length;
}

function getAggregacion(f: string, exp: string) {
    switch (f) {
        case 'sumar':
            return 'sum(' + exp + ')';
        case 'contar':
            return 'count(nullif(' + exp + ',false))';
        case 'promediar':
            return 'avg(' + exp + ')';
        default:
            return f + '(' + exp + ')';
    }
}

// construye una sola regex con 3 partes (grupos de captura) de regex diferentes, y hace el reemplazo que se pide por parametro
function regexpReplace(guno:string, gdos:string, gtres:string, sourceStr:string, replaceStr:string){
        let completeRegex = guno+gdos+gtres;
    return sourceStr.replace(new RegExp(completeRegex, 'g'), '$1'+ replaceStr+'$3');
}

function prefijarExpresion(v: VariableGenerable, variablesDefinidas:VariablesDefinidas, tableDefEst: DefinicionEstructuralTabla){
    v.insumos.variables.forEach(varInsumo => {
        if ( ! hasTablePrefix(varInsumo) && ( ! v.insumos.funciones || v.insumos.funciones.indexOf(varInsumo) == -1) && variablesDefinidas[varInsumo]){
            let definedVar = variablesDefinidas[varInsumo];
            let varPrefix = (definedVar.clase == 'calculada')? AppVarCal.sufijarCalculada(definedVar.tabla) : definedVar.tabla;
            let varWithPrefix = tableDefEst.operativo.toLowerCase() + '_' + varPrefix + '.' + varInsumo;

            // Se hacen 3 reemplazos porque no encontramos una regex que sirva para reemplazar de una sola vez todos
            // los casos encontrados Y un caso que esté al principio Y un caso que esté al final de la exp validada
            let baseRegex = `(${varInsumo})`;
            let noWordRegex = '([^\w\.])';
            v.expresionValidada = regexpReplace(noWordRegex, baseRegex, noWordRegex, v.expresionValidada, varWithPrefix); // caso que reemplaza casi todas las ocurrencias en la exp validada
            v.expresionValidada = regexpReplace('^()', baseRegex, noWordRegex, v.expresionValidada, varWithPrefix); // caso que reemplaza una posible ocurrencia al principio
            v.expresionValidada = regexpReplace(noWordRegex, baseRegex, '()$', v.expresionValidada, varWithPrefix); // caso que reemplaza una posible ocurrencia al final
        }
    });
}

export function getVariablesACalcular(variablesDatos:VariableComplete[], allPrefixedPks: PrefixedPks, CompilerOptions:CompilerOptions):VariableGenerable[] {
    return variablesDatos.map(function (v:VariableComplete) {
        let expresionValidada;
        var pkList = allPrefixedPks[v.unidad_analisis].pksString;
        if (v.opciones && v.opciones.length) {
            expresionValidada = 'CASE ' + v.opciones.map(function (opcion:VariableOpcion) {
                return '\n          WHEN ' + getWrappedExpression(opcion.expresion_condicion, pkList, CompilerOptions) +
                ' THEN ' + getWrappedExpression(opcion.expresion_valor || opcion.opcion, pkList, CompilerOptions)
            }).join('') + (v.expresion ? '\n          ELSE ' + getWrappedExpression(v.expresion, pkList, CompilerOptions) : '') + ' END'
        } else {
            expresionValidada = getWrappedExpression(v.expresion, pkList, CompilerOptions);
        }
        if (v.filtro){
            expresionValidada = 'CASE WHEN ' + v.filtro + ' THEN ' + expresionValidada + ' ELSE NULL END'
        }
        let insumos = getInsumos(expresionValidada);
        return <VariableGenerable>{
            tabla: v.operativo.toLowerCase() + '_' + v.tabla_datos,
            operativo: v.operativo,
            ua: v.unidad_analisis,
            nombreVariable: v.variable,
            expresionValidada,
            funcion_agregacion: v.funcion_agregacion,
            tabla_agregada: v.tabla_agregada,
            insumos
        }
    });
}

export function buildONClausule(leftAlias:string, rigthAlias:string, columnsToJoin: string[]){
    return columnsToJoin.map((col: string) =>
        `${leftAlias}.${col} = ${rigthAlias}.${col}`
    ).join(' and ');
}

export function sentenciaUpdate(definicion: BloqueVariablesGenerables, margen: number, defEst?: DefinicionEstructural, variablesDefinidas?: VariablesDefinidas): TextoSQL {
    var txtMargen = Array(margen + 1).join(' ');
    let tableDefEst = (defEst && defEst.tables && defEst.tables[definicion.ua]) ? defEst.tables[definicion.ua] : null;
    let defJoinExist: boolean = !!(definicion.joins && definicion.joins.length);
    let tablesToFromClausule: string[] = [];
    let completeWhereConditions: string = '';
    if (tableDefEst || defJoinExist) {
        let defJoinsWhere = defJoinExist ? definicion.joins.map(def => def.clausulaJoin).join(`\n    ${txtMargen}AND `) : '';
        completeWhereConditions = tableDefEst && defJoinExist ? `(${tableDefEst.where}) AND (${defJoinsWhere})` : tableDefEst ? tableDefEst.where : defJoinsWhere;
    }

    // se agregan prefijos a todas las variables de cada expresión validada
    if (variablesDefinidas){
        definicion.variables.forEach((v:VariableGenerable) => {
            if (v.insumos){
                prefijarExpresion(v, variablesDefinidas, tableDefEst)
            }
        });
    }

    // resultado: se tienen todos los alias de todas las variables (se eliminan duplicados usando Set)
    //let aliasesUsados = [...(new Set([].concat(...(definicion.variables.filter(v => (v.insumos && v.insumos.aliases)).map(v => v.insumos.aliases)))))]; // borrar
    let aliasesUsados: {[key:string]:Set<string>} = {};
    
    definicion.variables.filter(v => (v.insumos && v.insumos.aliases)).forEach(vac => {
        vac.insumos.aliases.forEach(alias => {
            if(defEst && defEst.aliases && defEst.aliases[alias]){
                if (! aliasesUsados[alias]){
                    aliasesUsados[alias] = new Set();
                }
                vac.insumos.variables.forEach(varName => {
                    if (hasTablePrefix(varName) && varName.indexOf(alias) == 0 ) { // si está en la primera posición
                        aliasesUsados[alias].add(varName)
                    }
                })
            }
        })
    })

    let aliasLeftJoins = '';
    likear(aliasesUsados).forEach((aliasVars,aliasName) => {
        let alias = defEst.aliases[aliasName];
        let selectFieldsAlias = defEst.tables[alias.tabla_datos].pks.concat([...aliasVars]).join(', ');
        if (alias) {
            aliasLeftJoins +=
`
${txtMargen}      LEFT JOIN (
${txtMargen}          SELECT ${selectFieldsAlias}
${txtMargen}            FROM ${tableDefEst.operativo.toLowerCase() + '_' + alias.tabla_datos} ${aliasName}`;
            aliasLeftJoins +=alias.where?
`
${txtMargen}            WHERE ${alias.where}`:'';
            aliasLeftJoins +=
`
${txtMargen}      ) ${aliasName} ON ${alias.on}`; 

        }
    });
        
    if (tableDefEst && tableDefEst.sourceBro){
        tablesToFromClausule.push(tableDefEst.sourceBro + ' ' + tableDefEst.sourceJoin + aliasLeftJoins);
    } 
    tablesToFromClausule = tablesToFromClausule.concat(defJoinExist ? definicion.joins.map(join => join.tabla) : []);

    //saca duplicados de las tablas agregadas y devuelve un arreglo con solo el campo tabla_agregada
    let tablasAgregadas = [...(new Set(definicion.variables.filter(v => v.tabla_agregada).map(v => v.tabla_agregada)))];
    tablasAgregadas.forEach(tabAgg => {
        let vars = definicion.variables.filter(v => v.tabla_agregada == tabAgg);
        tablesToFromClausule = tablesToFromClausule.concat(
            `
${txtMargen}    LATERAL (
${txtMargen}      SELECT
${txtMargen}          ${vars.map(v => `${getAggregacion(v.funcion_agregacion, v.expresionValidada)} as ${v.nombreVariable}`).join(',\n          ' + txtMargen)}
${txtMargen}        FROM ${defEst.tables[tabAgg].sourceAgg}
${txtMargen}        WHERE ${defEst.tables[tabAgg].whereAgg[definicion.ua]}
${txtMargen}    ) ${defEst.tables[tabAgg].aliasAgg}`
        );
    });

    return `${txtMargen}UPDATE ${tableDefEst ? tableDefEst.target : definicion.tabla}\n${txtMargen}  SET ` +
        definicion.variables.map(function (variable) {
            if (variable.tabla_agregada && variable.funcion_agregacion) {
                return `${variable.nombreVariable} = ${defEst.tables[variable.tabla_agregada].aliasAgg}.${variable.nombreVariable}`;
            } else {
                return `${variable.nombreVariable} = ${variable.expresionValidada}`;
            }
        }).join(`,\n      ${txtMargen}`) +
        (tablesToFromClausule.length ?
            `\n  ${txtMargen}FROM ${tablesToFromClausule.join(', ')}` +
            (completeWhereConditions ? `\n  ${txtMargen}WHERE ${completeWhereConditions}` : '')
            : '')
}

export function funcionGeneradora(definiciones: BloqueVariablesGenerables[], parametros: ParametrosGeneracion, defEst?: DefinicionEstructural, variablesDefinidas?: VariablesDefinidas): TextoSQL {
    return `CREATE OR REPLACE FUNCTION ${parametros.esquema}.${parametros.nombreFuncionGeneradora}() RETURNS TEXT
  LANGUAGE PLPGSQL
AS
$BODY$
BEGIN
`+
        definiciones.map(function (definicion) {
            return sentenciaUpdate(definicion, 2, defEst, variablesDefinidas) + ';'
        }).join('\n') + `
  RETURN 'OK';
END;
$BODY$;`;
}

export function getInsumos(expression: string): ExpresionParser.Insumos {
    return ExpresionParser.parse(expression).getInsumos();
}

export function getWrappedExpression(expression: string|number, pkExpression: string, options: ExpresionParser.CompilerOptions): string {
    var compiler = new ExpresionParser.Compiler(options);
    return compiler.toCode(ExpresionParser.parse(expression), pkExpression);
}


/**
 * @param nvardef son las que variables a calcular cuyos insumos no están en vardef
 * @param variablesDefinidas variables con insumos definidos
 */
export function separarEnGruposPorNivelYOrigen(nvardef: VariableGenerable[], variablesDefinidas: string[], defEst?: DefinicionEstructural): BloqueVariablesGenerables[] {
    var listaOut: BloqueVariablesGenerables[] = [];
    var lenAnt: number;
    var definicionesOrd: VariableGenerable[] = [];
    var compararJoins = function (joins1: Join[], joins2: Join[]) {
        return (joins1 === undefined && joins2 === undefined ||
            JSON.stringify(joins1) === JSON.stringify(joins2)) ? true : false;
    };
    var nuevoBloqueListaOut = function (defVariable: VariableGenerable): BloqueVariablesGenerables {
        var {joins, ...varAnalizada } = defVariable;
        var nuevo: BloqueVariablesGenerables = { tabla: defVariable.tabla, variables: [varAnalizada], ua: defVariable.ua };
        if (joins !== undefined) {
            nuevo.joins = joins;
        }
        return nuevo;
    };
    do {
        lenAnt = nvardef.length;
        var i = 0;
        while (i < nvardef.length) {
            if (!checkInsumos(nvardef[i], variablesDefinidas, definicionesOrd, nvardef, defEst)) {
                i++;
            }
        };
    } while (nvardef.length > 0 && nvardef.length != lenAnt);
    if (nvardef.length > 0) {
        throw new Error("Error, no se pudo determinar el orden de la variable '" + nvardef[0].nombreVariable + "' y otras")
    }
    definicionesOrd.forEach(function (defVariable: VariableGenerable) {
        var {joins, ...varAnalizada } = defVariable;
        let tabla = defVariable.tabla;
        if (listaOut.length == 0) {
            listaOut.push(nuevoBloqueListaOut(defVariable));
        } else {
            var enNivel = defVariable.insumos.variables.length ? defVariable.insumos.variables.map(function (varInsumo) {
                return listaOut.findIndex(function (nivel) {
                    return nivel.variables.findIndex(function (vvar) {
                        return vvar.nombreVariable == varInsumo
                    }) == -1 ? false : true
                })
            }).reduce(function (elem: number, anterior: number) {
                return elem > anterior ? elem : anterior;
            }) : 0;
            if (enNivel >= 0 && listaOut.length === enNivel + 1) {
                listaOut.push(nuevoBloqueListaOut(defVariable));
            } else {
                var nivelTabla = listaOut[enNivel + 1].tabla == tabla && compararJoins(listaOut[enNivel + 1].joins, joins) ? enNivel + 1 : listaOut.findIndex(function (nivel, i) {
                    return nivel.tabla == tabla && compararJoins(nivel.joins, joins) && i > enNivel + 1
                });
                if (nivelTabla >= 0) {
                    listaOut[nivelTabla].variables.push(varAnalizada);
                } else {
                    listaOut.push(nuevoBloqueListaOut(defVariable));
                }
            }
        }
    });
    //console.log(JSON.stringify(listaOut));
    return listaOut;
}

export const sufijo_agregacion:string='_agg';
