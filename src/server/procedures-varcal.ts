"use strict";

import * as VarCal from "./var-cal";
import { ProcedureContext, PrefixedPks, DefinicionEstructuralTabla, VariablesDefinidas, 
    VariableComplete, BloqueVariablesGenerables, TableDefinition, tiposTablaDato, UnidadDeAnalisis, TableDefinitions, coreFunctionParameters } from "./types-varcal";
import { VarCalType, AppVarCal } from "./app-varcal";

import * as fs from "fs-extra";
import * as likear from "like-ar";
import * as bg from "best-globals";
import { CompilerOptions } from "expre-parser";
import { TablaDatos } from "operativos";

var procedures = [
    {
        action: 'calculadas/generar',
        parameters: [
            { name: 'operativo', typeName: 'text', references: 'operativos', }
        ],
        coreFunction: async function (context: ProcedureContext, parameters: coreFunctionParameters) {
            //TODO deshardcodear y pasar a algun archivo
            let compilerOptions: CompilerOptions = { language: 'sql', varWrapper: 'null2zero', divWrapper: 'div0err', elseWrapper: 'lanzar_error' };
            var be: VarCalType = context.be as VarCalType;
            let operativo = parameters.operativo;
            var db = be.db;
            var drops:string[]=[];
            var inserts:string[]=[];
            var allPrefixedPks:PrefixedPks = {};
            var tableDefs:TableDefinitions = {};
            let UAs = <UnidadDeAnalisis[]> await be.getUAs(context.client, parameters.operativo);
            await be.armarDefEstructural(context.client, operativo); //actualizo las defEst porque desde que se levantó node pueden haber cambiado
            
            UAs.forEach((ua) => {
                let uaName = ua.unidad_analisis
                let estParaGenTabla:DefinicionEstructuralTabla = be.defEsts[operativo].tables[uaName];
                let tableName = estParaGenTabla.target
                drops.unshift("drop table if exists " + db.quoteIdent(tableName) + ";");
                var pks = estParaGenTabla.pks;
                var prefixedPks = pks.map((pk:string) => operativo.toLowerCase() + '_' + uaName + '.' + pk);
                allPrefixedPks[uaName] = {
                    pks: prefixedPks,
                    pksString: prefixedPks.join(', ')
                }
                var pkString = pks.join(', ');
                inserts.push(
                    "INSERT INTO " + db.quoteIdent(tableName) + " (" + pkString + ") " +
                    "SELECT " + pkString + " FROM " + estParaGenTabla.sourceBro + ' ' + estParaGenTabla.sourceJoin + ";"
                )    
            });
            
            //TODO: asignar el promise.all a una variable (tdfes?) y sacar el then, (analizar si no conviene pasarlo a operativos)
            await Promise.all(
                UAs.map((ua) => be.generateBaseTableDef(context.client, new TablaDatos(operativo, AppVarCal.sufijarCalculada(ua.unidad_analisis), tiposTablaDato.calculada, ua.unidad_analisis)))
            ).then((tdefs: TableDefinition[]) => {
                tdefs.forEach(function(tdef:TableDefinition){
                    be.loadTableDef(tdef); //carga el tableDef para las grillas (las grillas de calculadas NO deben permitir insert o update)
                    let newTDef = bg.changing(tdef, {allow: {insert: true, update: true}}); // modifica los allows para el dumpSchemaPartial (necesita insert y update)
                    tableDefs[newTDef.name] = be.getTableDefFunction(newTDef);
                });
            })

            var sqls = await be.dumpDbSchemaPartial(tableDefs, {});
            var allSqls = drops.concat(sqls.mainSql).concat(sqls.enancePart).concat(inserts)

            let variablesDatoResult = await be.getVariablesDatos(context.client, operativo);
            var variablesACalcular = VarCal.getVariablesACalcular((<VariableComplete[]> variablesDatoResult.rows).filter(v=>v.clase == 'calculada'), allPrefixedPks, compilerOptions);

            var allVariables: VariablesDefinidas = {};
            variablesDatoResult.rows.forEach((vDato:VariableComplete) => allVariables[vDato.variable] = { tabla: vDato.unidad_analisis, clase: vDato.clase });
            likear(allPrefixedPks).forEach(function (prefixedPk, ua) {
                prefixedPk.pks.forEach(pk => allVariables[pk] = { tabla: ua })
            });
            var grupoVariables: BloqueVariablesGenerables[] = VarCal.separarEnGruposPorNivelYOrigen(variablesACalcular, Object.keys(likear(allVariables).filter(v => v.clase != 'calculada')), be.defEsts[operativo]);
            var parametrosGeneracion = {
                nombreFuncionGeneradora: 'gen_fun_var_calc',
                esquema: be.config.db.schema,
            };
            let todayDate = be.getTodayForDB();
            let updateFechaCalculada = `
                UPDATE operativos SET calculada='${todayDate}' WHERE operativo='${operativo}';
                UPDATE tabla_datos SET generada='${todayDate}' WHERE operativo='${operativo}' AND tipo='${tiposTablaDato.calculada}';
            `;
            var funcionGeneradora = VarCal.funcionGeneradora(grupoVariables, parametrosGeneracion, be.defEsts[operativo], allVariables);
            allSqls = ['do $SQL_DUMP$\n begin', "set search_path = " + be.config.db.schema + ';'].concat(allSqls).concat(funcionGeneradora, 'perform gen_fun_var_calc();', updateFechaCalculada,  'end\n$SQL_DUMP$');
            let localMiroPorAhora = './local-miro-por-ahora.sql';
            var todoElScript = allSqls.join('\n----\n') + '--- generado: ' + new Date() + '\n';
            fs.writeFileSync(localMiroPorAhora, todoElScript, { encoding: 'utf8' })
            await context.client.query(todoElScript).execute();
            return 'generado !';
        }
    }
];

export {procedures};