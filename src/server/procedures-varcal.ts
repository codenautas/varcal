"use strict";

import * as fs from "fs-extra";
import { AppVarCalType } from "./app-varcal";
import { ProcedureContext, VarCalculator } from "./types-varcal";

var procedures = [
    {
        action: 'calculadas/generar',
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
            // let orderedCalcVars: VariableCalculada[] = sortCalcVariablesByDependency(varCalculator.getVarsCalculadas(), varCalculator.getRelevamientoVars().map(v=>v.variable), <DefinicionEstructural>{});
            // let grupos:BloqueVariablesACalcular[] = separarEnGrupos(orderedCalcVars);
            //sentencia update()

            // varCalculator.armarFuncionGeneradora();
            let todoElScript:string = varCalculator.getFinalSql();
            
            fs.writeFileSync('./local-miro-por-ahora.sql', todoElScript, { encoding: 'utf8' })
            await context.client.query(todoElScript).execute();

            return 'generado !';
        }
    }
];

export { procedures };

