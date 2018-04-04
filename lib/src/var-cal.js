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
    definiciones.forEach(function (defVariable) {
        var { tabla } = defVariable, varAnalizada = __rest(defVariable, ["tabla"]);
        if (listaOut.length == 0) {
            listaOut.push({ tabla, variables: [varAnalizada] });
        }
        else {
            var enNivel = listaOut.findIndex(function (nivel) {
                return defVariable.insumos.variables.findIndex(function (vvar, i) {
                    return nivel.variables[i].nombreVariable == vvar;
                }) === -1 ? false : true;
            });
            if (enNivel >= 0 && listaOut.length === enNivel + 1) {
                listaOut.push({ tabla, variables: [varAnalizada] });
            }
            else if (enNivel >= 0 && listaOut.length > enNivel) {
                listaOut[enNivel + 1].variables.push(varAnalizada);
            }
            else {
                listaOut[0].variables.push(varAnalizada);
            }
        }
    });
    return listaOut;
}
exports.separarEnGruposPorNivelYOrigen = separarEnGruposPorNivelYOrigen;
//# sourceMappingURL=var-cal.js.map