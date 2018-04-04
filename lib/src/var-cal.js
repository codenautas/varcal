"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
function calcularNiveles(definiciones) {
    /*versión preliminar es sólo una idea y falta terminarla*/
    //console.log('****'+definiciones);
    var listaOut;
    listaOut = [];
    definiciones.variables.forEach(function (varAnalizada) {
        if (listaOut.length == 0) {
            listaOut.push({ tabla: definiciones.tabla, variables: [varAnalizada] });
        }
        else {
            var enNivel = listaOut.findIndex(function (nivel) {
                //velem.nombreVariable==varAnalizada.nombreVariable
                return varAnalizada.insumos.variables.findIndex(function (vvar, i) {
                    return nivel.variables[i].nombreVariable == vvar;
                }) === -1 ? false : true;
            });
            if (enNivel >= 0 && listaOut.length === enNivel + 1) {
                listaOut.push({ tabla: definiciones.tabla, variables: [varAnalizada] });
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
exports.calcularNiveles = calcularNiveles;
//# sourceMappingURL=var-cal.js.map