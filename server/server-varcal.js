"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_varcal_1 = require("./app-varcal");
const operativos_1 = require("operativos");
var AppVarCal = app_varcal_1.emergeAppVarCal(operativos_1.emergeAppOperativos(operativos_1.AppBackend));
new AppVarCal().start();
//# sourceMappingURL=server-varcal.js.map