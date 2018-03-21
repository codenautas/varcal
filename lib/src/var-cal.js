"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function funcionGeneradora(definiciones, parametros) {
    return `create or replace function ${parametros.esquema}.${parametros.nombreFuncionGeneradora}() returns text
  language plpgsql
as
$BODY$
begin` +
        definiciones.map(function (definicion) {
            return `
  update ${definicion.tabla} set ${definicion.nombreVariable} = ${definicion.expresionValidada};`;
        }) + `
  RETURN 'OK';
end;
$BODY$;`;
}
exports.funcionGeneradora = funcionGeneradora;
//# sourceMappingURL=var-cal.js.map