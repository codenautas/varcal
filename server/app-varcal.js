"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const procedures_varcal_1 = require("./procedures-varcal");
function emergeAppVarCal(Base) {
    return class AppVarCal extends Base {
        constructor(...args) {
            super(...args);
        }
        getProcedures() {
            var be = this;
            return super.getProcedures().then(function (procedures) {
                return procedures.concat(procedures_varcal_1.ProceduresVarCal.map(be.procedureDefCompleter, be));
            });
        }
        clientIncludes(req, hideBEPlusInclusions) {
            return super.clientIncludes(req, hideBEPlusInclusions).concat([
                { type: 'js', src: 'client/varcal.js' },
            ]);
        }
        getMenu() {
            let myMenuPart = [
                { menuType: 'proc', name: 'generar', proc: 'origenes/generar' },
            ];
            let menu = { menu: super.getMenu().menu.concat(myMenuPart) };
            return menu;
        }
        prepareGetTables() {
            super.prepareGetTables();
            this.getTableDefinition = Object.assign({}, this.getTableDefinition);
            this.appendToTableDefinition('parametros', function (tableDef) {
                tableDef.fields.push({ name: 'esquema_tablas_externas', typeName: 'text', defaultValue: 'ext', editable: false });
            });
            this.appendToTableDefinition('tabla_datos', function (tableDef) {
                console.log(tableDef);
                tableDef.fields.push({ name: 'estructura_cerrada', typeName: 'boolean', editable: false });
                tableDef.constraints.push({ consName: 'estructura_cerrada true/null', constraintType: 'check', expr: 'estructura_cerrada is true' });
            });
        }
    };
}
exports.emergeAppVarCal = emergeAppVarCal;
//# sourceMappingURL=app-varcal.js.map