"use strict";

import * as VarCal from "./var-cal";
import * as fs from "fs-extra";
import * as likear from "like-ar";
import * as operativos from "operativos";
import {TableDefinition, Variable, VariableOpcion, tiposTablaDato} from "operativos";
import { ProcedureContext } from "./types-varcal";
import { VarCalType } from "./app-varcal";

export interface coreFunctionParameters{
    operativo: string
}

export type CoreFunction = (context: operativos.ProcedureContext, parameters: coreFunctionParameters) => Promise<VarCal.DefinicionEstructural>;

var procedures = [
    {
        action: 'calculadas/generar',
        parameters: [
            { name: 'operativo', typeName: 'text', references: 'operativos', }
        ],
        coreFunction: async function (context: ProcedureContext, parameters: coreFunctionParameters) {
            var be: VarCalType = context.be as VarCalType;
            let operativo = parameters.operativo;
            var db = be.db;
            var drops:string[]=[];
            var creates:string[]=[];
            var inserts:string[]=[];
            var allPrefixedPks:{
                [key:string]: {pks:string[], pksString: string}
            } = {};
            var tableDefs:operativos.TableDefinitions = {};

            var resultUA = await context.client.query('select * from unidad_analisis ua where operativo = $1', [parameters.operativo]).fetchAll();
            
            await Promise.all(
                resultUA.rows.map(row => be.generateBaseTableDef(context.client, {operativo:parameters.operativo, tabla_datos: row.unidad_analisis, unidad_analisis: row.unidad_analisis, tipo: tiposTablaDato.calculada}))
            ).then((tdefs: TableDefinition[]) => {
                tdefs.forEach(function(tdef:TableDefinition){
                    //saco el sufijo a tdef.name para obetener la unidad de analisis origen
                    var tableName = tdef.name;
                    let unidadAnalisis = tableName.replace(tiposTablaDato.calculada, '');
                    var estParaGenTabla:VarCal.DefinicionEstructuralTabla = be.defEstructural.tables[unidadAnalisis];
                    
                    drops.unshift("drop table if exists " + db.quoteIdent(tableName) + ";");
                    var pks = estParaGenTabla.pks;
                    var prefixedPks = pks.map((pk:string) => unidadAnalisis + '.' + pk);
                    allPrefixedPks[unidadAnalisis] = {
                        pks: prefixedPks,
                        pksString: prefixedPks.join(', ')
                    }
                    var pkString = pks.join(', ');
                    inserts.push(
                        "INSERT INTO " + db.quoteIdent(tableName) + " (" + pkString + ") " +
                        "SELECT " + pkString + " FROM " + estParaGenTabla.sourceBro + ' ' + estParaGenTabla.sourceJoin + ";"
                    )
                    
                    tableDefs[tableName] = be.loadTableDef(tdef);
                });
            })

            var sqls = await be.dumpDbSchemaPartial(tableDefs, {});
            creates = creates.concat(sqls.mainSql).concat(sqls.enancePart);
            var allSqls = drops.concat(creates).concat(inserts)
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
            function wrapExpression(expression:string|number, pkExpression:string) {
                var opts:VarCal.CompilerOptions = { language: 'sql', varWrapper: 'null2zero', divWrapper: 'div0err', elseWrapper: 'lanzar_error' };
                return VarCal.getWrappedExpression(expression, pkExpression, opts);
            }
            var variablesACalcular = variablesDatoResult.rows.map(function (v:Variable & {opciones: VariableOpcion[]}) {
                let expresionValidada;
                var pkList = allPrefixedPks[v.unidad_analisis].pksString;
                if (v.opciones && v.opciones.length) {
                    expresionValidada = 'CASE ' + v.opciones.map(function (opcion:VariableOpcion) {
                        return '\n          WHEN ' + wrapExpression(opcion.expresion_condicion, pkList) +
                            ' THEN ' + wrapExpression(opcion.expresion_valor || opcion.opcion, pkList)
                    }).join('') + (v.expresion ? '\n          ELSE ' + wrapExpression(v.expresion, pkList) : '') + ' END'
                } else {
                    expresionValidada = wrapExpression(v.expresion, pkList);
                }
                let insumos = VarCal.getInsumos(expresionValidada);
                return {
                    tabla: v.unidad_analisis,
                    nombreVariable: v.variable,
                    expresionValidada,
                    insumos,
                    funcion_agregacion: v.funcion_agregacion,
                    tabla_agregada: v.tabla_agregada
                }
            });
            var variablesDatoResult = await context.client.query(`
                SELECT variable, unidad_analisis, clase from variables
                WHERE operativo = $1 AND activa
            `, [operativo]).fetchAll();
            var allVariables: VarCal.VariablesDefinidas = {};
            variablesDatoResult.rows.forEach((vDato:operativos.Variable) => allVariables[vDato.variable] = { tabla: vDato.unidad_analisis, clase: vDato.clase });
            likear(allPrefixedPks).forEach(function (prefixedPk, ua) {
                prefixedPk.pks.forEach(pk => allVariables[pk] = { tabla: ua })
            });
            var grupoVariables = VarCal.separarEnGruposPorNivelYOrigen(variablesACalcular, Object.keys(likear(allVariables).filter(v => v.clase != 'calculada')), be.defEstructural);
            var parametrosGeneracion = {
                nombreFuncionGeneradora: 'gen_fun_var_calc',
                esquema: be.config.db.schema,
            };
            var funcionGeneradora = VarCal.funcionGeneradora(grupoVariables, parametrosGeneracion, be.defEstructural, allVariables);
            allSqls = ['do $SQL_DUMP$\n begin', "set search_path = " + be.config.db.schema + ';'].concat(allSqls).concat(funcionGeneradora, 'perform gen_fun_var_calc();', 'end\n$SQL_DUMP$');
            let localMiroPorAhora = './local-miro-por-ahora.sql';
            var now = new Date();
            var todoElScript = allSqls.join('\n----\n') + '--- generado: ' + now.toISOString() + '\n';
            fs.writeFileSync(localMiroPorAhora, todoElScript, { encoding: 'utf8' })
            await context.client.query(todoElScript).execute();
            return 'generado !';
        }
    }
];

export {procedures};