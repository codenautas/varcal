"use strict";

import * as operativos from "operativos";
import {TableDefinition, tiposTablaDato, UnidadDeAnalisis} from "operativos";
import * as VarCal from "./var-cal";
import { ProcedureContext, DefinicionEstructural, PrefixedPks, DefinicionEstructuralTabla, VariablesDefinidas, 
    VariableComplete, BloqueVariablesGenerables } from "./types-varcal";
import { VarCalType } from "./app-varcal";

import * as fs from "fs-extra";
import * as likear from "like-ar";
import * as bg from "best-globals";
import { CompilerOptions } from "expre-parser";

export interface coreFunctionParameters{
    operativo: string
}

export type CoreFunction = (context: operativos.ProcedureContext, parameters: coreFunctionParameters) => Promise<DefinicionEstructural>;

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
            var tableDefs:operativos.TableDefinitions = {};
            var resultUA = await context.client.query('select * from unidad_analisis ua where operativo = $1', [operativo]).fetchAll();
            await be.armarDefEstructural(context.client, operativo); //actualizo las defEst porque desde que se levantó node pueden haber cambiado
            resultUA.rows.forEach((row:UnidadDeAnalisis) => {
                let ua = row.unidad_analisis
                let tableName = be.sufijarUACalculada(ua);
                let estParaGenTabla:DefinicionEstructuralTabla = be.defEsts[operativo].tables[ua];
                drops.unshift("drop table if exists " + db.quoteIdent(tableName) + ";");
                var pks = estParaGenTabla.pks;
                var prefixedPks = pks.map((pk:string) => ua + '.' + pk);
                allPrefixedPks[ua] = {
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
                resultUA.rows.map(row => be.generateBaseTableDef(context.client, {operativo:operativo, tabla_datos: be.sufijarUACalculada(row.unidad_analisis), unidad_analisis: row.unidad_analisis, tipo: tiposTablaDato.calculada}))
            ).then((tdefs: TableDefinition[]) => {
                tdefs.forEach(function(tdef:TableDefinition){
                    be.loadTableDef(tdef); //carga el tableDef para las grillas (las grillas de calculadas NO deben permitir insert o update)
                    let newTDef = bg.changing(tdef, {allow: {insert: true, update: true}}); // modifica los allows para el dumpSchemaPartial (necesita insert y update)
                    tableDefs[newTDef.name] = be.getTableDefFunction(newTDef);
                });
            })

            var sqls = await be.dumpDbSchemaPartial(tableDefs, {});
            var allSqls = drops.concat(sqls.mainSql).concat(sqls.enancePart).concat(inserts)
            // await context.client.executeSentences(allSqls);
            var variablesDatoResult = await context.client.query(`SELECT
               v.*, (
                      select jsonb_agg(to_jsonb(vo.*) order by vo.orden, vo.opcion) 
                        from variables_opciones vo 
                        where vo.operativo = v.operativo and vo.variable = v.variable) as opciones
               FROM variables v
               WHERE v.operativo = $1
                 AND v.clase = 'calculada'
                 AND v.activa
            `, [operativo]).fetchAll();
            var variablesACalcular = VarCal.getVariablesACalcular(<VariableComplete[]> variablesDatoResult.rows, allPrefixedPks, compilerOptions);
            
            //TODO nombre de variable duplicado, ademas se está haciendo una query parecida, hacer una sola y filtrarla después
            var variablesDatoResult = await context.client.query(`
                SELECT variable, unidad_analisis, clase from variables
                WHERE operativo = $1 AND activa
            `, [operativo]).fetchAll();
            var allVariables: VariablesDefinidas = {};
            variablesDatoResult.rows.forEach((vDato:operativos.Variable) => allVariables[vDato.variable] = { tabla: vDato.unidad_analisis, clase: vDato.clase });
            likear(allPrefixedPks).forEach(function (prefixedPk, ua) {
                prefixedPk.pks.forEach(pk => allVariables[pk] = { tabla: ua })
            });
            var grupoVariables: BloqueVariablesGenerables[] = VarCal.separarEnGruposPorNivelYOrigen(variablesACalcular, Object.keys(likear(allVariables).filter(v => v.clase != 'calculada')), be.defEsts[operativo]);
            var parametrosGeneracion = {
                nombreFuncionGeneradora: 'gen_fun_var_calc',
                esquema: be.config.db.schema,
            };
            let updateFechaCalculada = `UPDATE operativos SET calculada='${bg.date.today().toYmd()}' WHERE operativo='${operativo}';`;
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