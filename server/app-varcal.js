"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
const operativos = require("operativos");
const procedures_varcal_1 = require("./procedures-varcal");
const table_alias_1 = require("./table-alias");
__export(require("./types-varcal"));
function emergeAppVarCal(Base) {
    return class AppVarCal extends Base {
        constructor(...args) {
            super(...args);
        }
        getProcedures() {
            //TODO: es igual que en datos-ext llevarlo a operativos
            var be = this;
            return super.getProcedures().then(function (procedures) {
                return procedures.concat(procedures_varcal_1.ProceduresVarCal.map(be.procedureDefCompleter, be));
            });
        }
        clientIncludes(req, hideBEPlusInclusions) {
            //TODO: es igual que en datos-ext llevarlo a operativos
            return super.clientIncludes(req, hideBEPlusInclusions).concat([
                { type: 'js', src: 'client/varcal.js' },
            ]);
        }
        getMenu() {
            //TODO: es igual que en datos-ext llevarlo a operativos
            let myMenuPart = [
                { menuType: 'proc', name: 'generar', proc: 'calculadas/generar' },
                { menuType: 'table', name: 'alias' },
            ];
            let menu = { menu: super.getMenu().menu.concat(myMenuPart) };
            return menu;
        }
        prepareGetTables() {
            //TODO: es igual que en datos-ext llevarlo a operativos
            super.prepareGetTables();
            this.getTableDefinition = Object.assign({}, this.getTableDefinition, { alias: table_alias_1.alias });
        }
    };
}
exports.emergeAppVarCal = emergeAppVarCal;
exports.AppVarCal = emergeAppVarCal(operativos.emergeAppOperativos(operativos.AppBackend));
//# sourceMappingURL=app-varcal.js.map