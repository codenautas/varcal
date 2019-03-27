"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
const bg = require("best-globals");
const procedures_varcal_1 = require("./procedures-varcal");
const types_varcal_1 = require("./types-varcal");
// re-export my file of types for external modules
__export(require("./types-varcal"));
__export(require("./var-cal"));
function emergeAppVarCal(Base) {
    return class AppVarCal extends Base {
        constructor(...args) {
            super(args);
            this.allProcedures = this.allProcedures.concat(procedures_varcal_1.procedures);
            this.allClientFileNames.push({ type: 'js', module: 'varcal', modPath: '../client', file: 'varcal.js', path: 'client_modules' });
        }
        configStaticConfig() {
            super.configStaticConfig();
        }
        generateAndLoadTableDefs() {
            let varCalculator = types_varcal_1.VarCalculator.instanceObj;
            let tableDefs = {};
            let calcTDatos = varCalculator.getTDCalculadas();
            calcTDatos.forEach(tablaDato => {
                let tdef = this.generateBaseTableDef(tablaDato);
                this.loadTableDef(tdef); //carga el tableDef para las grillas (las grillas de calculadas NO deben permitir insert o update)
                let newTDef = bg.changing(tdef, { allow: { insert: true, update: true } }); // modifica los allows para el dumpSchemaPartial (necesita insert y update)
                tableDefs[newTDef.name] = this.getTableDefFunction(newTDef);
            });
            return tableDefs;
        }
        generateBaseTableDef(tablaDatos) {
            let tDef = super.generateBaseTableDef(tablaDatos);
            if (tablaDatos.esCalculada()) {
                // esto se agrega para que las calculadas muestren también todos los campos de su sourceBro
                // TODO: ver si hay que sacar el que_busco del fetchall y fetch one de tabla_datos               
                tDef.foreignKeys = [{ references: tablaDatos.que_busco, fields: tablaDatos.pks, onDelete: 'cascade', displayAllFields: true }];
                // tDef.detailTables = estParaGenTabla.detailTables;
                tDef.sql.isReferable = true;
            }
            return tDef;
        }
        prepareGetTables() {
            super.prepareGetTables();
            this.appendToTableDefinition('operativos', function (tableDef) {
                tableDef.fields.push({ name: "calcular", typeName: "bigint", editable: false, clientSide: 'generarCalculadas' }, { name: 'calculada', typeName: 'timestamp', editable: true });
            });
        }
        getMenu() {
            return { menu: super.getMenu().menu };
        }
    };
}
exports.emergeAppVarCal = emergeAppVarCal;
exports.AppVarCal = emergeAppVarCal(types_varcal_1.emergeAppOperativos(types_varcal_1.AppBackend));
//# sourceMappingURL=app-varcal.js.map