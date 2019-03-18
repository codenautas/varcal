"use strict";

import * as fs from "fs-extra";
import { AppVarCalType } from "./app-varcal";
import { ProcedureContext, VarCalculator } from "./types-varcal";
import { VariableCalculada } from "./variable-calculada";
import { sortCalcVariablesByDependency } from "./var-cal";

var procedures = [
    {
        action: 'calculadas_generar',
        parameters: [
            { name: 'operativo', typeName: 'text', references: 'operativos', }
        ],
        coreFunction: async function (context: ProcedureContext, parameters: {operativo: string}) {
            let varCalculator = new VarCalculator(context.be as AppVarCalType, context.client, parameters.operativo);
            await varCalculator.fetchDataFromDB();
            varCalculator.generateDropsAndInserts();
            await varCalculator.generateSchemaAndLoadTableDefs();
            varCalculator.parseCalcVarExpressions();
            
            //TODO: pasar a objeto sortCalcVars y separarEnGrupo
            varCalculator.separarEnGruposOrdenados();
            varCalculator.armarFuncionGeneradora();

            // varCalculator.armarFuncionGeneradora();
            let todoElScript:string = varCalculator.getFinalSql();
            
            fs.writeFileSync('./local-miro-por-ahora.sql', todoElScript, { encoding: 'utf8' })
            await context.client.query(todoElScript).execute();

            return 'generado !';
        }
    }
];

export { procedures };

