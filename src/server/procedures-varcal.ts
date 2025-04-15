"use strict";

import * as fs from "fs-extra";
import { AppVarCalType } from "./app-varcal";
import { ProcedureContext, VarCalculator } from "./types-varcal";
import { CoreFunctionParameters } from "operativos";

var procedures = [
    {
        action: 'calculadas_generar',
        parameters: [
            { name: 'operativo', typeName: 'text', references: 'operativos', }
        ],
        coreFunction: async function (context: ProcedureContext, parameters: CoreFunctionParameters<{ operativo: string}>) {
            let varCalculator = new VarCalculator(context.be as AppVarCalType, context.client, parameters.operativo);
            await varCalculator.fetchDataFromDB();
            let todoElScript:string = await varCalculator.calculate();
            
            fs.writeFileSync('./local-varcal-generated.sql', todoElScript, { encoding: 'utf8' })
            await context.client.query(todoElScript).execute();

            return 'generado !';
        }
    }
];

export { procedures };
