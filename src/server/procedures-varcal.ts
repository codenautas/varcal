"use strict";

import * as VarCal from "./var-cal";
import * as fs from "fs-extra";
import * as likear from "like-ar";
import * as operativos from "operativos";
import {TableDefinition, Variable, VariableOpcion} from "operativos";

type OrigenesGenerarParameters = {
    operativo: string
    origen: string
}

const operativo = 'REPSIC';
const estructuraParaGenerar: VarCal.DefinicionEstructural = {
    aliases: {
        padre: {
            tabla: 'personas',
            on: 'padre.id_caso = personas.id_caso AND padre.p0 = personas.p11 AND padre.operativo = personas.operativo',
        }
    },
    tables: {
        grupo_personas: {
            target: 'grupo_personas_calc',
            sourceBro: 'grupo_personas',
            pkString: 'operativo,id_caso',
            sourceJoin: '',
            where: 'grupo_personas.operativo = grupo_personas_calc.operativo and grupo_personas.id_caso = grupo_personas_calc.id_caso',
            aliasAgg: 'grupo_personas_agg',
            sourceAgg: 'grupo_personas_calc',
            whereAgg: {},
            detailTables: [
                {
                    table: 'personas_calc',
                    fields: ["operativo", "id_caso"],
                    abr: "p"
                }
            ],
        },
        personas: {
            target: 'personas_calc',
            sourceBro: 'personas',
            pkString: 'operativo, id_caso, p0',
            sourceJoin: 'inner join grupo_personas using (operativo, id_caso)',
            where: 'personas.operativo = personas_calc.operativo and personas.id_caso = personas_calc.id_caso and personas.p0 = personas_calc.p0',
            aliasAgg: 'personas_agg',
            sourceAgg: 'personas_calc inner join personas ON personas_calc.operativo=personas.operativo and personas_calc.id_caso=personas.id_caso and personas_calc.p0=personas.p0',
            whereAgg: {
                grupo_personas: 'personas_calc.operativo = grupo_personas.operativo and personas_calc.id_caso = grupo_personas.id_caso'
            },
        }
    }
}
// estructuraParaGenerar.tables.personas.laMadreEs=estructuraParaGenerar.tables.grupo_personas;

var ProceduresVarCal = [
    {
        action: 'calculadas/generar',
        parameters: [
            { name: 'operativo', typeName: 'text', references: 'operativos', }
        ],
        coreFunction: async function (context: operativos.ProcedureContext, parameters: OrigenesGenerarParameters) {
            parameters.operativo = 'REPSIC';
            var be: operativos.AppBackend = context.be;
            var db = be.db;
            /* -------------- ESTO SE HACE UNA SOLA VEZ AL CERRAR, PASAR A CERRAR CUANDO LO HAGAMOS ------ */
            await context.client.query(
                `DELETE FROM variables_opciones op
                    WHERE EXISTS 
                        (SELECT variable FROM variables v 
                            WHERE v.operativo=op.operativo and v.variable=op.variable 
                                and v.clase='relevamiento' and v.operativo=$1)`
                , [parameters.operativo]
            ).execute();
            await context.client.query(
                `DELETE FROM varcal.variables WHERE operativo = $1 and clase = 'relevamiento'`,
                [parameters.operativo]
            ).execute();
            await context.client.query(`INSERT INTO varcal.variables(
                operativo, variable, unidad_analisis, tipovar, nombre,  activa, 
                clase, cerrada)
              select c1.operativo, var_name, c0.unidad_analisis, 
                case tipovar 
                  when 'si_no' then 'opciones' 
                  when 'si_no_nn' then 'opciones' 
                else tipovar end, 
                nombre, true, 
                'relevamiento', true
                from casilleros c1, lateral casilleros_recursivo(operativo, id_casillero),
                (select operativo, id_casillero, unidad_analisis from casilleros where operativo =$1 and tipoc='F') c0
                where c1.operativo =c0.operativo and ultimo_ancestro = c0.id_casillero and c1.tipovar is not null
                order by orden_total`,
                [parameters.operativo]
            ).execute();
            await context.client.query(`
                with pre as (
                    select c1.operativo, var_name, c0.unidad_analisis, tipovar, orden_total, c1.id_casillero
                        from casilleros c1, lateral casilleros_recursivo(operativo, id_casillero),
                            (select operativo, id_casillero,unidad_analisis from casilleros where operativo ='REPSIC' and tipoc='F') c0
                        where c1.operativo =c0.operativo and ultimo_ancestro = c0.id_casillero and c1.tipovar is not null
                        order by orden_total
                )
                INSERT INTO varcal.variables_opciones(
                        operativo, variable, opcion, nombre, orden)
                  select op.operativo, pre.var_name, casillero::integer,op.nombre, orden
                    from  pre join casilleros op on pre.operativo=op.operativo and pre.id_casillero=op.padre 
                    where pre.operativo=$1
                    order by orden_total, orden`
                , [parameters.operativo]
            ).execute();
            /* -------------- fin ESTO SE HACE UNA SOLA VEZ --------------------------------------------- */
            var drops:string[]=[];
            var creates:string[]=[];
            var inserts:string[]=[];
            var allPrefixedPks:{
                [key:string]: {pks:string[], pksString: string}
            } = {};
            var tableDefs:operativos.TableDefinitions = {};
            var resTypeNameTipoVar = await context.client.query(`SELECT jsonb_object(array_agg(tipovar), array_agg(type_name)) 
                    FROM meta.tipovar                    
            `).fetchUniqueValue();
            var typeNameTipoVar = resTypeNameTipoVar.value;
            // var resultUA = await context.client.query(`SELECT 
            //        /* pk_padre debe ser el primer campo */
            //        ${be.sqls.exprFieldUaPkPadre} as pk_padre, ua.*,
            //        (select jsonb_agg(to_jsonb(v.*)) from variables v where v.operativo=ua.operativo and v.unidad_analisis=ua.unidad_analisis and v.clase='calculada' and v.activa) as variables
            //     FROM unidad_analisis ua
            //     WHERE operativo=$1
            //     ORDER BY 1
            // `, [operativo]).fetchAll();
            var resultUA = await context.client.query(`SELECT *
                FROM unidad_analisis ua
                WHERE operativo=$1
            `, [operativo]).fetchAll();
            resultUA.rows.forEach(function (row) {
                var estParaGen:VarCal.DefinicionEstructuralTabla = estructuraParaGenerar.tables[row.unidad_analisis];
                var tableName = estParaGen.target;
                drops.unshift("drop table if exists " + db.quoteIdent(tableName) + ";");
                var broDef = (<operativos.TableDefinitionFunction>be.tableStructures[estParaGen.sourceBro])(be.getContextForDump())
                var primaryKey = row.pk_padre.concat(row.pk_agregada);
                primaryKey.unshift('operativo'); // GENE              
                var prefixedPks = primaryKey.map((pk:string) => row.unidad_analisis + '.' + pk);
                allPrefixedPks[row.unidad_analisis] = {
                    pks: prefixedPks,
                    pksString: prefixedPks.join(', ')
                }
                var isAdmin = context.user.rol === 'admin';
                var tableDefParteCtte:TableDefinition = {
                    name: tableName,
                    fields: broDef.fields.filter(field => field.isPk).concat(
                        row.variables ? (row.variables.map((v: operativos.Variable) => { return { name: v.variable, typeName: typeNameTipoVar[v.tipovar], editable: false } }))
                            : []
                    ),
                    editable: isAdmin,
                    primaryKey: primaryKey,
                    foreignKeys: [
                        { references: estParaGen.sourceBro, fields: primaryKey, onDelete: 'cascade', displayAllFields: true }
                    ],
                    detailTables: estParaGen.detailTables,
                    sql: {
                        skipEnance: true,
                        isReferable: true
                    }
                }
                be.tableStructures[tableName] = tableDefs[tableName] = function (context: operativos.Context):TableDefinition {
                    return context.be.tableDefAdapt(tableDefParteCtte, context);
                };
                var pkString = primaryKey.join(', ');
                inserts.push(
                    "INSERT INTO " + db.quoteIdent(tableName) + " (" + pkString + ") " +
                    "SELECT " + pkString + " FROM " + estParaGen.sourceBro + ' ' + estParaGen.sourceJoin + ";"
                )
            });
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
            var grupoVariables = VarCal.separarEnGruposPorNivelYOrigen(variablesACalcular, Object.keys(likear(allVariables).filter(v => v.clase != 'calculada')), estructuraParaGenerar);
            var parametrosGeneracion = {
                nombreFuncionGeneradora: 'gen_fun_var_calc',
                esquema: be.config.db.schema,
            };
            var funcionGeneradora = VarCal.funcionGeneradora(grupoVariables, parametrosGeneracion, estructuraParaGenerar, allVariables);
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

export {ProceduresVarCal};