"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const VarCal = require("./var-cal");
const fs = require("fs-extra");
const likear = require("like-ar");
const operativo = 'REPSIC';
var ProceduresVarCal = [
    {
        action: 'definicion_estructural/armar',
        parameters: [
            { name: 'operativo', references: 'operativos', typeName: 'text' },
        ],
        coreFunction: async function (context, parameters) {
            var sqlParams = [parameters.operativo];
            var results = {
                aliases: await context.client.query(`Select alias, (to_jsonb(alias.*)) alias_def_est
                    From alias
                    Where operativo=$1`, sqlParams).fetchAll(),
                tables: await context.client.query(`SELECT ua.*, to_jsonb(array_agg(v.variable order by v.orden)) pk_arr
                    FROM unidad_analisis ua join variables v on v.operativo=ua.operativo and v.unidad_analisis=ua.unidad_analisis and v.es_pk
                    where ua.operativo=$1
                    group by ua.operativo, ua.unidad_analisis`, sqlParams).fetchAll()
            };
            let defEst = {
                aliases: {},
                tables: {}
            };
            results.aliases.rows.forEach(function (a) { defEst.aliases[a.alias] = a.alias_def_est; });
            //falta trabajar results para obtener la pinta de  defEst
            results.tables.rows.forEach(function (table) {
                let tua = table.unidad_analisis;
                let tDefEst = {
                    sourceBro: tua,
                    target: tua + VarCal.sufijo_tabla_calculada,
                    pkString: table.pk_arr.join(', '),
                    aliasAgg: tua + VarCal.sufijo_agregacion,
                };
                tDefEst.where = table.pk_arr.map((pk) => `${tDefEst.sourceBro}.${pk} = ${tDefEst.target}.${pk}`).join(' and ');
                tDefEst.sourceAgg = tDefEst.target;
                tDefEst.whereAgg = {};
                tDefEst.sourceJoin = '';
                if (table.padre) {
                    //calculo pks del padre
                    let pksPadre = table.pk_arr;
                    table.pk_agregada.split(',').forEach(pkAgregada => {
                        let index = pksPadre.indexOf(pkAgregada);
                        if (index) {
                            pksPadre.splice(index, 1);
                        }
                    });
                    // Calculo whereAgg
                    tDefEst.whereAgg[table.padre] = pksPadre.map((pk) => `${table.padre}.${pk} = ${tDefEst.target}.${pk}`).join(' and ');
                    // Calculo sourceJoin
                    tDefEst.sourceJoin = `inner join ${table.padre} using (${pksPadre.join(', ')})`;
                }
                tDefEst.detailTables = [];
                defEst.tables[tua] = tDefEst;
            });
            //Seteo de detail tables a los padres de las tablas que tienen padre
            results.tables.rows.filter(t => t.padre).forEach(function (table) {
                // TODO: completar la tabla hija
                defEst.tables[table.padre].detailTables.push({
                    table: table.unidad_analisis,
                    fields: table.pk_arr,
                    abr: table.unidad_analisis.substr(0, 1).toUpperCase()
                });
            });
            return defEst;
        }
    },
    {
        action: 'calculadas/generar',
        parameters: [
            { name: 'operativo', typeName: 'text', references: 'operativos', }
        ],
        coreFunction: async function (context, parameters) {
            parameters.operativo = 'REPSIC';
            var be = context.be;
            var db = be.db;
            var drops = [];
            var creates = [];
            var inserts = [];
            var allPrefixedPks = {};
            var tableDefs = {};
            var resTypeNameTipoVar = await context.client.query(`SELECT jsonb_object(array_agg(tipovar), array_agg(type_name)) FROM tipovar`).fetchUniqueValue();
            var typeNameTipoVar = resTypeNameTipoVar.value;
            this.sqls = {
                exprFieldUaPkPadre: `
                coalesce((
                            with recursive uas(operativo, profundidad, padre, pk) as (
                              select ua.operativo, 1 as profundidad, ua.padre, null as pk
                            union all
                              select uas.operativo, profundidad+1, p.padre, p.pk_agregada
                                from uas left join unidad_analisis p on p.unidad_analisis = uas.padre and p.operativo = uas.operativo
                                where p.unidad_analisis is not null
                            ) select array_agg(pk order by profundidad desc) from uas where pk is not null
                          ),array[]::text[])`
            };
            var resultUA = await context.client.query(`
            select *, ${this.sqls.exprFieldUaPkPadre} as pk_padre,
              (select jsonb_agg(to_jsonb(h.*)) from unidad_analisis h where ua.unidad_analisis=h.padre ) as details
              from unidad_analisis ua
              where operativo = $1
            `, [operativo]).fetchAll();
            var estructuraParaGenerar = await be.procedure['definicion_estructural/armar'].coreFunction(context, { operativo });
            resultUA.rows.forEach(function (row) {
                var estParaGenTabla = estructuraParaGenerar.tables[row.unidad_analisis];
                var tableName = estParaGenTabla.target;
                drops.unshift("drop table if exists " + db.quoteIdent(tableName) + ";");
                var broDef = be.tableStructures[estParaGenTabla.sourceBro](be.getContextForDump());
                var primaryKey = row.pk_padre.concat(row.pk_agregada);
                primaryKey.unshift('operativo'); //TODO: DESHARDCODEAR pk
                var prefixedPks = primaryKey.map((pk) => row.unidad_analisis + '.' + pk);
                allPrefixedPks[row.unidad_analisis] = {
                    pks: prefixedPks,
                    pksString: prefixedPks.join(', ')
                };
                var isAdmin = context.user.rol === 'admin';
                var tableDefParteCtte = {
                    name: tableName,
                    fields: broDef.fields.filter(field => field.isPk).concat(row.variables ? (row.variables.map((v) => { return { name: v.variable, typeName: typeNameTipoVar[v.tipovar], editable: false }; }))
                        : []),
                    editable: isAdmin,
                    primaryKey: primaryKey,
                    foreignKeys: [
                        { references: estParaGenTabla.sourceBro, fields: primaryKey, onDelete: 'cascade', displayAllFields: true }
                    ],
                    detailTables: estParaGenTabla.detailTables,
                    sql: {
                        skipEnance: true,
                        isReferable: true
                    }
                };
                be.tableStructures[tableName] = tableDefs[tableName] = function (context) {
                    return context.be.tableDefAdapt(tableDefParteCtte, context);
                };
                var pkString = primaryKey.join(', ');
                inserts.push("INSERT INTO " + db.quoteIdent(tableName) + " (" + pkString + ") " +
                    "SELECT " + pkString + " FROM " + estParaGenTabla.sourceBro + ' ' + estParaGenTabla.sourceJoin + ";");
            });
            var sqls = await be.dumpDbSchemaPartial(tableDefs, {});
            creates = creates.concat(sqls.mainSql).concat(sqls.enancePart);
            var allSqls = drops.concat(creates).concat(inserts);
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
            function wrapExpression(expression, pkExpression) {
                var opts = { language: 'sql', varWrapper: 'null2zero', divWrapper: 'div0err', elseWrapper: 'lanzar_error' };
                return VarCal.getWrappedExpression(expression, pkExpression, opts);
            }
            var variablesACalcular = variablesDatoResult.rows.map(function (v) {
                let expresionValidada;
                var pkList = allPrefixedPks[v.unidad_analisis].pksString;
                if (v.opciones && v.opciones.length) {
                    expresionValidada = 'CASE ' + v.opciones.map(function (opcion) {
                        return '\n          WHEN ' + wrapExpression(opcion.expresion_condicion, pkList) +
                            ' THEN ' + wrapExpression(opcion.expresion_valor || opcion.opcion, pkList);
                    }).join('') + (v.expresion ? '\n          ELSE ' + wrapExpression(v.expresion, pkList) : '') + ' END';
                }
                else {
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
                };
            });
            var variablesDatoResult = await context.client.query(`
                SELECT variable, unidad_analisis, clase from variables
                WHERE operativo = $1 AND activa
            `, [operativo]).fetchAll();
            var allVariables = {};
            variablesDatoResult.rows.forEach((vDato) => allVariables[vDato.variable] = { tabla: vDato.unidad_analisis, clase: vDato.clase });
            likear(allPrefixedPks).forEach(function (prefixedPk, ua) {
                prefixedPk.pks.forEach(pk => allVariables[pk] = { tabla: ua });
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
            fs.writeFileSync(localMiroPorAhora, todoElScript, { encoding: 'utf8' });
            await context.client.query(todoElScript).execute();
            return 'generado !';
        }
    }
];
exports.ProceduresVarCal = ProceduresVarCal;
//# sourceMappingURL=procedures-varcal.js.map