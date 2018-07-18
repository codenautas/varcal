"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0)
            t[p[i]] = s[p[i]];
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
const ExpresionParser = require("expre-parser");
const likear = require("like-ar");
const operativos_1 = require("operativos");
exports.sufijo_agregacion = '_agg';
;
;
//export type  ListaVariablesAnalizadasOut=ListaVariablesAnalizadas[];
function getAggregacion(f, exp) {
    switch (f) {
        case 'sumar':
            return 'sum(' + exp + ')';
        case 'contar':
            return 'count(nullif(' + exp + ',false))';
        default:
            return f + '(' + exp + ')';
    }
}
// construye una sola regex con 3 partes (grupos de captura) de regex diferentes, y hace el reemplazo que se pide por parametro
function regexpReplace(guno, gdos, gtres, sourceStr, replaceStr) {
    let completeRegex = guno + gdos + gtres;
    return sourceStr.replace(new RegExp(completeRegex, 'g'), '$1' + replaceStr + '$3');
}
function prefijarExpresion(v, variablesDefinidas) {
    v.insumos.variables.forEach(varInsumo => {
        if (!hasTablePrefix(varInsumo) && (!v.insumos.funciones || v.insumos.funciones.indexOf(varInsumo) == -1) && variablesDefinidas[varInsumo]) {
            let prefix = (variablesDefinidas[varInsumo].clase == 'calculada') ? variablesDefinidas[varInsumo].tabla + '_' + operativos_1.tiposTablaDato.calculada : variablesDefinidas[varInsumo].tabla;
            let varWithPrefix = prefix + '.' + varInsumo;
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
function generateConditions(left, rigth, fields) {
    return fields.map((field) => `${left}.${field} = ${rigth}.${field}`).join(' and ');
}
exports.generateConditions = generateConditions;
function sentenciaUpdate(definicion, margen, defEst, variablesDefinidas) {
    var txtMargen = Array(margen + 1).join(' ');
    let tableDefEst = (defEst && defEst.tables && defEst.tables[definicion.tabla]) ? defEst.tables[definicion.tabla] : null;
    let defJoinExist = !!(definicion.joins && definicion.joins.length);
    let tablesToFromClausule = [];
    let completeWhereConditions = '';
    if (tableDefEst || defJoinExist) {
        let defJoinsWhere = defJoinExist ? definicion.joins.map(def => def.clausulaJoin).join(`\n    ${txtMargen}AND `) : '';
        completeWhereConditions = tableDefEst && defJoinExist ? `(${tableDefEst.where}) AND (${defJoinsWhere})` : tableDefEst ? tableDefEst.where : defJoinsWhere;
    }
    // se agregan prefijos a todas las variables de cada expresión validada
    if (variablesDefinidas) {
        definicion.variables.forEach((v) => {
            if (v.insumos) {
                prefijarExpresion(v, variablesDefinidas);
            }
        });
    }
    // resultado: se tienen todos los alias de todas las variables (se eliminan duplicados usando Set)
    //let aliasesUsados = [...(new Set([].concat(...(definicion.variables.filter(v => (v.insumos && v.insumos.aliases)).map(v => v.insumos.aliases)))))]; // borrar
    let aliasesUsados = {};
    definicion.variables.filter(v => (v.insumos && v.insumos.aliases)).forEach(vac => {
        vac.insumos.aliases.forEach(alias => {
            if (defEst && defEst.aliases && defEst.aliases[alias]) {
                if (!aliasesUsados[alias]) {
                    aliasesUsados[alias] = new Set();
                }
                vac.insumos.variables.forEach(varName => {
                    if (hasTablePrefix(varName) && varName.indexOf(alias) == 0) { // si está en la primera posición
                        aliasesUsados[alias].add(varName);
                    }
                });
            }
        });
    });
    let aliasLeftJoins = '';
    likear(aliasesUsados).forEach((aliasVars, aliasName) => {
        let alias = defEst.aliases[aliasName];
        let selectFieldsAlias = defEst.tables[alias.tabla_datos].pks.concat([...aliasVars]).join(', ');
        if (alias) {
            aliasLeftJoins +=
                `
${txtMargen}      LEFT JOIN (
${txtMargen}          SELECT ${selectFieldsAlias}
${txtMargen}            FROM ${alias.tabla_datos} ${aliasName}`;
            aliasLeftJoins += alias.where ?
                `
${txtMargen}            WHERE ${alias.where}` : '';
            aliasLeftJoins +=
                `
${txtMargen}      ) ${aliasName} ON ${alias.on}`;
        }
    });
    tablesToFromClausule = tablesToFromClausule.concat((tableDefEst && tableDefEst.sourceBro) ? tableDefEst.sourceBro + ' ' + tableDefEst.sourceJoin + aliasLeftJoins : []);
    tablesToFromClausule = tablesToFromClausule.concat(defJoinExist ? definicion.joins.map(def => def.tabla) : []);
    //saca duplicados de las tablas agregadas y devuelve un arreglo con solo el campo tabla_agregada
    let tablasAgregadas = [...(new Set(definicion.variables.filter(v => v.tabla_agregada).map(v => v.tabla_agregada)))];
    tablasAgregadas.forEach(tabAgg => {
        let vars = definicion.variables.filter(v => v.tabla_agregada == tabAgg);
        tablesToFromClausule = tablesToFromClausule.concat(`
${txtMargen}    LATERAL (
${txtMargen}      SELECT
${txtMargen}          ${vars.map(v => `${getAggregacion(v.funcion_agregacion, v.expresionValidada)} as ${v.nombreVariable}`).join(',\n          ' + txtMargen)}
${txtMargen}        FROM ${defEst.tables[tabAgg].sourceAgg}
${txtMargen}        WHERE ${defEst.tables[tabAgg].whereAgg[definicion.tabla]}
${txtMargen}    ) ${defEst.tables[tabAgg].aliasAgg}`);
    });
    return `${txtMargen}UPDATE ${tableDefEst ? tableDefEst.target : definicion.tabla}\n${txtMargen}  SET ` +
        definicion.variables.map(function (variable) {
            if (variable.tabla_agregada && variable.funcion_agregacion) {
                return `${variable.nombreVariable} = ${defEst.tables[variable.tabla_agregada].aliasAgg}.${variable.nombreVariable}`;
            }
            else {
                return `${variable.nombreVariable} = ${variable.expresionValidada}`;
            }
        }).join(`,\n      ${txtMargen}`) +
        (tablesToFromClausule.length ?
            `\n  ${txtMargen}FROM ${tablesToFromClausule.join(', ')}` +
                (completeWhereConditions ? `\n  ${txtMargen}WHERE ${completeWhereConditions}` : '')
            : '');
}
exports.sentenciaUpdate = sentenciaUpdate;
function funcionGeneradora(definiciones, parametros, defEst, variablesDefinidas) {
    return `CREATE OR REPLACE FUNCTION ${parametros.esquema}.${parametros.nombreFuncionGeneradora}() RETURNS TEXT
  LANGUAGE PLPGSQL
AS
$BODY$
BEGIN
` +
        definiciones.map(function (definicion) {
            return sentenciaUpdate(definicion, 2, defEst, variablesDefinidas) + ';';
        }).join('\n') + `
  RETURN 'OK';
END;
$BODY$;`;
}
exports.funcionGeneradora = funcionGeneradora;
function getInsumos(expression) {
    return ExpresionParser.parse(expression).getInsumos();
}
exports.getInsumos = getInsumos;
function getWrappedExpression(expression, pkExpression, options) {
    var compiler = new ExpresionParser.Compiler(options);
    return compiler.toCode(ExpresionParser.parse(expression), pkExpression);
}
exports.getWrappedExpression = getWrappedExpression;
function hasTablePrefix(variable) {
    return variable.match(/^.+\..+$/);
}
let checkInsumos = function (defVariable, vardef, definicionesOrd, nvardef, defEst) {
    var { nombreVariable, insumos } = defVariable;
    var cantDef = 0;
    insumos.variables.forEach(function (varInsumos) {
        // si esta variable tiene un prefijo && la variable sin prefijo está definida && el prefijo está en la tabla de aliases
        if (hasTablePrefix(varInsumos) && defEst) {
            var [prefix, varName] = varInsumos.split('.');
            if (vardef.indexOf(varName) > -1 && (prefix in Object.assign({}, defEst.tables, defEst.aliases))) {
                vardef.push(varInsumos); // then agrego esta variable a vardef
            }
        }
        cantDef = vardef.indexOf(varInsumos) >= 0 ? cantDef + 1 : cantDef;
    });
    if (cantDef == insumos.variables.length) {
        vardef.push(nombreVariable);
        definicionesOrd.push(defVariable);
        if (nvardef.indexOf(defVariable) >= 0) {
            nvardef.splice(nvardef.indexOf(defVariable), 1);
        }
    }
    return cantDef == insumos.variables.length;
};
/**
 * @param nvardef son las que variables a calcular cuyos insumos no están en vardef
 * @param variablesDefinidas variables con insumos definidos
 */
function separarEnGruposPorNivelYOrigen(nvardef, variablesDefinidas, defESt) {
    var listaOut;
    listaOut = [];
    var lenAnt;
    var definicionesOrd = [];
    var compararJoins = function (joins1, joins2) {
        return (joins1 === undefined && joins2 === undefined ||
            JSON.stringify(joins1) === JSON.stringify(joins2)) ? true : false;
    };
    var nuevoBloqueListaOut = function (defVariable) {
        var { tabla, joins } = defVariable, varAnalizada = __rest(defVariable, ["tabla", "joins"]);
        var nuevo = { tabla, variables: [varAnalizada] };
        if (joins !== undefined) {
            nuevo.joins = joins;
        }
        return nuevo;
    };
    do {
        lenAnt = nvardef.length;
        var i = 0;
        while (i < nvardef.length) {
            if (!checkInsumos(nvardef[i], variablesDefinidas, definicionesOrd, nvardef, defESt)) {
                i++;
            }
        }
        ;
    } while (nvardef.length > 0 && nvardef.length != lenAnt);
    if (nvardef.length > 0) {
        throw new Error("Error, no se pudo determinar el orden de la variable '" + nvardef[0].nombreVariable + "' y otras");
    }
    definicionesOrd.forEach(function (defVariable) {
        var { tabla, joins } = defVariable, varAnalizada = __rest(defVariable, ["tabla", "joins"]);
        if (listaOut.length == 0) {
            listaOut.push(nuevoBloqueListaOut(defVariable));
        }
        else {
            var enNivel = defVariable.insumos.variables.length ? defVariable.insumos.variables.map(function (varInsumo) {
                return listaOut.findIndex(function (nivel) {
                    return nivel.variables.findIndex(function (vvar) {
                        return vvar.nombreVariable == varInsumo;
                    }) == -1 ? false : true;
                });
            }).reduce(function (elem, anterior) {
                return elem > anterior ? elem : anterior;
            }) : 0;
            if (enNivel >= 0 && listaOut.length === enNivel + 1) {
                listaOut.push(nuevoBloqueListaOut(defVariable));
            }
            else {
                var nivelTabla = listaOut[enNivel + 1].tabla == tabla && compararJoins(listaOut[enNivel + 1].joins, joins) ? enNivel + 1 : listaOut.findIndex(function (nivel, i) {
                    return nivel.tabla == tabla && compararJoins(nivel.joins, joins) && i > enNivel + 1;
                });
                if (nivelTabla >= 0) {
                    listaOut[nivelTabla].variables.push(varAnalizada);
                }
                else {
                    listaOut.push(nuevoBloqueListaOut(defVariable));
                }
            }
        }
    });
    //console.log(JSON.stringify(listaOut));
    return listaOut;
}
exports.separarEnGruposPorNivelYOrigen = separarEnGruposPorNivelYOrigen;
//# sourceMappingURL=var-cal.js.map