"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs-extra");
const types_varcal_1 = require("./types-varcal");
var procedures = [
    {
        action: 'calculadas_generar',
        parameters: [
            { name: 'operativo', typeName: 'text', references: 'operativos', }
        ],
        coreFunction: async function (context, parameters) {
            let varCalculator = new types_varcal_1.VarCalculator(context.be, context.client, parameters.operativo);
            await varCalculator.fetchDataFromDB();
            let todoElScript = await varCalculator.calculate();
            fs.writeFileSync('./local-miro-por-ahora.sql', todoElScript, { encoding: 'utf8' });
            await context.client.query(todoElScript).execute();
            return 'generado !';
        }
    }
];
exports.procedures = procedures;
//# sourceMappingURL=procedures-varcal.js.map