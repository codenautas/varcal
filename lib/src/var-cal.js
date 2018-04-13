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
;
;
//export type  ListaVariablesAnalizadasOut=ListaVariablesAnalizadas[];
function sentenciaUpdate(definicion, margen) {
    var txtMargen = Array(margen + 1).join(' ');
    return `${txtMargen}UPDATE ${definicion.tabla}\n${txtMargen}  SET ` +
        definicion.variables.map(function ({ nombreVariable, expresionValidada }) {
            return `${nombreVariable} = ${expresionValidada}`;
        }).join(`,\n      ${txtMargen}`) +
        (definicion.joins && definicion.joins.length ?
            `\n  ${txtMargen}FROM ` + definicion.joins.map(def => def.tabla).join(', ') +
                `\n  ${txtMargen}WHERE ` + definicion.joins.map(def => def.clausulaJoin).join(`\n    ${txtMargen}AND `)
            : '');
}
exports.sentenciaUpdate = sentenciaUpdate;
function funcionGeneradora(definiciones, parametros) {
    return `CREATE OR REPLACE FUNCTION ${parametros.esquema}.${parametros.nombreFuncionGeneradora}() RETURNS TEXT
  LANGUAGE PLPGSQL
AS
$BODY$
BEGIN
` +
        definiciones.map(function (definicion) {
            return sentenciaUpdate(definicion, 2) + ';';
        }).join('\n') + `
  RETURN 'OK';
END;
$BODY$;`;
}
exports.funcionGeneradora = funcionGeneradora;
function laMisma(varAnalizada) {
    return varAnalizada;
}
exports.laMisma = laMisma;
function separarEnGruposPorNivelYOrigen(definiciones, variablesDefinidas) {
    var listaOut;
    listaOut = [];
    var vardef; //variables con insumos definidos
    vardef = variablesDefinidas;
    var nvardef;
    nvardef = []; // son las que variables cuyos insumos no están en vardef.
    var lenAnt;
    var definicionesOrd = [];
    definiciones.forEach(function (defVariable) {
        var { tabla, nombreVariable, insumos } = defVariable, varAnalizada = __rest(defVariable, ["tabla", "nombreVariable", "insumos"]);
        var cantDef = 0;
        insumos.variables.forEach(function (varInsumos) {
            cantDef = vardef.indexOf(varInsumos) >= 0 ? cantDef + 1 : cantDef;
        });
        if (cantDef == insumos.variables.length) {
            vardef.push(nombreVariable);
            definicionesOrd.push(defVariable);
            if (nvardef.indexOf(defVariable) >= 0) {
                nvardef.splice(nvardef.indexOf(defVariable), 1);
            }
        }
        else {
            if (nvardef.findIndex(function (varNvardef) { return varNvardef.nombreVariable == nombreVariable; }) == -1) {
                nvardef.push(defVariable);
            }
        }
    });
    do {
        lenAnt = nvardef.length;
        var i = 0;
        while (i < nvardef.length) {
            var defVariable = nvardef[i];
            var { tabla, nombreVariable, insumos } = defVariable, varAnalizada = __rest(defVariable, ["tabla", "nombreVariable", "insumos"]);
            var cantDef = 0;
            insumos.variables.forEach(function (varInsumos) {
                cantDef = vardef.indexOf(varInsumos) >= 0 ? cantDef + 1 : cantDef;
            });
            if (cantDef == insumos.variables.length) {
                vardef.push(nombreVariable);
                definicionesOrd.push(defVariable);
                nvardef.splice(i, 1);
            }
            else {
                i++;
            }
        }
        ;
    } while (nvardef.length > 0 && nvardef.length != lenAnt);
    if (nvardef.length > 0) {
        throw new Error("Error, no se pudo determinar el orden de la variable '" + nvardef[0].nombreVariable + "' y otras");
    }
    definicionesOrd.forEach(function (defVariable) {
        var { tabla } = defVariable, varAnalizada = __rest(defVariable, ["tabla"]);
        if (listaOut.length == 0) {
            listaOut.push({ tabla, variables: [varAnalizada] });
        }
        else {
            var enNivel = defVariable.insumos.variables.map(function (varInsumo) {
                return listaOut.findIndex(function (nivel) {
                    return nivel.variables.findIndex(function (vvar) {
                        return vvar.nombreVariable == varInsumo;
                    }) == -1 ? false : true;
                });
            }).reduce(function (elem, anterior) {
                return elem > anterior ? elem : anterior;
            });
            if (enNivel >= 0 && listaOut.length === enNivel + 1) {
                listaOut.push({ tabla, variables: [varAnalizada] });
            }
            else {
                var nivelTabla = listaOut[enNivel + 1].tabla == tabla ? enNivel + 1 : listaOut.findIndex(function (nivel, i) {
                    return nivel.tabla == tabla && i > enNivel + 1;
                });
                if (nivelTabla >= 0) {
                    listaOut[nivelTabla].variables.push(varAnalizada);
                }
                else {
                    listaOut.push({ tabla, variables: [varAnalizada] });
                }
            }
        }
    });
    return listaOut;
}
exports.separarEnGruposPorNivelYOrigen = separarEnGruposPorNivelYOrigen;
//# sourceMappingURL=var-cal.js.map