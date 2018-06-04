"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_varcal_1 = require("./app-varcal");
const operativos_1 = require("operativos");
const backend_plus_1 = require("backend-plus");
var AppVarCal = app_varcal_1.emergeAppVarCal(operativos_1.emergeAppOperativos(backend_plus_1.AppBackend));
new AppVarCal().start();
//# sourceMappingURL=server-varcal.js.map