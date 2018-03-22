"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
;
function sentenciaUpdate(definicion, margen) {
    var txtMargen = Array(margen + 1).join(' ');
    return `${txtMargen}UPDATE ${definicion.tabla}\n${txtMargen}  SET ` +
        definicion.variables.map(function ({ nombreVariable, expresionValidada }) {
            return `${nombreVariable} = ${expresionValidada}`;
        }).join(`,\n      ${txtMargen}`);
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
//# sourceMappingURL=var-cal.js.map