"use strict";

var changing = require('best-globals').changing;
var bestGlobals = require('best-globals');
var datetime = bestGlobals.datetime;
var fs = require('fs-extra');
var path = require('path');
var sqlTools = require('sql-tools');
var relEnc = require('rel-enc');
var likear = require('like-ar');
var formTypes = require('rel-enc').formTypes;

var VarCal=require('varcal');

var discrepances = require('discrepances');

const pkPersonas = [{fieldName:'operativo'}, {fieldName:'id_caso'}, {fieldName:'p0'}];
const fkPersonas = [{target:'operativo', source:'operativo'}, {target:'id_caso', source:'id_caso'}];
const pkGrupoPersonas = [{fieldName:'operativo'},{fieldName:'id_caso'}];
const formPrincipal = 'F1';
const operativo='REPSIC';
const estructuraParaGenerar={
    aliases:{
        padre: {
            tabla: 'personas',
            on: 'padre.id_caso = personas.id_caso AND padre.p0 = personas.p11 AND padre.operativo = personas.operativo',
        }
    },
    tables:{
        grupo_personas:{
            target:'grupo_personas_calc',
            sourceBro:'grupo_personas',
            pkString:'operativo,id_caso',
            sourceJoin:'',
            where:'grupo_personas.operativo = grupo_personas_calc.operativo and grupo_personas.id_caso = grupo_personas_calc.id_caso',
            aliasAgg: 'grupo_personas_agg',
            sourceAgg: 'grupo_personas_calc',
            whereAgg: {},
            detailTables: [
                {
                    table: 'personas_calc',
                    fields: ["operativo","id_caso"],
                    abr: "p"
                }
            ],
        },
        personas:{
            target:'personas_calc',
            sourceBro:'personas',
            pkString:'operativo, id_caso, p0',
            sourceJoin:'inner join grupo_personas using (operativo, id_caso)',
            where:'personas.operativo = personas_calc.operativo and personas.id_caso = personas_calc.id_caso and personas.p0 = personas_calc.p0',
            aliasAgg: 'personas_agg',
            sourceAgg: 'personas_calc inner join personas ON personas_calc.operativo=personas.operativo and personas_calc.id_caso=personas.id_caso and personas_calc.p0=personas.p0',
            whereAgg:{
                grupo_personas:'personas_calc.operativo = grupo_personas.operativo and personas_calc.id_caso = grupo_personas.id_caso'
            },
        }
    }
}
// estructuraParaGenerar.tables.personas.laMadreEs=estructuraParaGenerar.tables.grupo_personas;

var struct_personas={
    tableName:'personas',
    pkFields:pkPersonas,
    childTables:[],
};

var struct_grupo_personas={
    tableName:'grupo_personas',
    pkFields:pkGrupoPersonas,
    childTables:[
        changing(struct_personas,{fkFields: fkPersonas})
    ]
};

var ProceduresRepsic = [
    {   
        action:'generar/formularios',
        parameters:[
            {name:'recorrido', typeName:'integer', references:'recorridos'}
        ],
        coreFunction:async function(context, parameters){
            var be=context.be;
            let resultUA = await context.client.query(
                `select *
                   from unidad_analisis
                   where principal = true and operativo = $1
                `,
                [operativo]
            ).fetchOneRowIfExists();
            if (resultUA.rowCount === 0){
                throw new Error('No se configuró una unidad de analisis como principal');
            }
            let row = resultUA.row;
            console.log('xxxxxxxxxxxxxxxxxxxxxxxxx resultUA',resultUA)
            console.log('xxxxxxxxxxxxxxxxxxxxxxxxx row',row)
            let resultPreguntas = await be.procedure['cargar/preguntas_ua'].coreFunction(context, row)
            var contenedorVacio = {};
            resultPreguntas.forEach(function(defPregunta){
                contenedorVacio[defPregunta.var_name] = defPregunta.unidad_analisis?[]:null;
            });
            var resultInsert = await context.client.query(
                `insert into formularios_json 
                   select $4, debe_haber.id_caso, $3 || jsonb_build_object('u1', recorrido)
                     from (select recorrido, armar_id(recorrido, s) as id_caso
                             from (select recorrido, cant_cues from supervision where recorrido=$2) r, lateral generate_series(1,cant_cues) s
                     ) debe_haber left join formularios_json hay on hay.id_caso::integer = debe_haber.id_caso and hay.operativo=$1
                   where hay.id_caso is null`,
                [operativo, parameters.recorrido, contenedorVacio, operativo]
            ).execute();
            return {agregadas:resultInsert.rowCount}
        }
    },
    {
        action:'upload/file',
        progress: true,
        parameters:[
            {name: 'id_adjunto', typeName: 'integer'},
            {name: 'nombre', typeName: 'text'},
        ],
        files:{count:1},
        coreFunction:function(context, parameters, files){
            let be=context.be;
            let client=context.client;
            context.informProgress(be.messages.fileUploaded);
            let file = files[0]
            let ext = path.extname(file.path).substr(1);
            let originalFilename = file.originalFilename.slice(0,-(ext.length+1));
            let filename= parameters.nombre || originalFilename;
            let newPath = 'local-attachments/file-';
            var createResponse = function createResponse(adjuntoRow){
                let resultado = {
                    message: 'La subida se realizó correctamente (update)',
                    nombre: adjuntoRow.nombre,
                    nombre_original: adjuntoRow.nombre_original,
                    ext: adjuntoRow.ext,
                    fecha: adjuntoRow.fecha,
                    hora: adjuntoRow.hora,
                    id_adjunto: adjuntoRow.id_adjunto
                }
                return resultado
            }
            var moveFile = function moveFile(file, id_adjunto, extension){
                fs.move(file.path, newPath + id_adjunto + '.' + extension, { overwrite: true });
            }
            return Promise.resolve().then(function(){
                if(parameters.id_adjunto){
                    return context.client.query(`update adjuntos set nombre= $1,nombre_original = $2, ext = $3, ruta = concat('local-attachments/file-',$4::text,'.',$3::text), fecha = now(), hora = date_trunc('seconds',current_timestamp-current_date)
                        where id_adjunto = $4 returning *`,
                        [filename, originalFilename, ext, parameters.id_adjunto]
                    ).fetchUniqueRow().then(function(result){
                        return createResponse(result.row)
                    }).then(function(resultado){
                        moveFile(file,resultado.id_adjunto,resultado.ext);
                        return resultado
                    });
                }else{
                    return context.client.query(`insert into adjuntos (nombre, nombre_original, ext, fecha, hora) values ($1,$2,$3,now(), date_trunc('seconds',current_timestamp-current_date)) returning *`,
                        [filename, originalFilename, ext]
                    ).fetchUniqueRow().then(function(result){
                        return context.client.query(`update adjuntos set ruta = concat('local-attachments/file-',id_adjunto::text,'.',ext)
                            where id_adjunto = $1 returning *`,
                            [result.row.id_adjunto]
                        ).fetchUniqueRow().then(function(result){
                            return createResponse(result.row)
                        }).then(function(resultado){
                            moveFile(file,resultado.id_adjunto,resultado.ext);
                            return resultado
                        });
                    });
                }
            }).catch(function(err){
                console.log('ERROR',err.message);
                throw err;
            });
        }
    },
    {   
        action:'subir/puntos',
        parameters:[
            {name:'recorrido'       , typeName:'integer', references:'recorridos'},
            {name:'puntos'          , typeName:'jsonb'                           },
        ],
        encoding:'JSON',
        coreFunction:async function(context, parameters){
            console.log('xxxxxxxxxxxxx')
            console.log(parameters)
            console.log(typeof parameters.puntos)
            console.log(JSON.stringify(parameters.puntos))
            var be=context.be;
            let result = await context.client.query(
                `insert into recorridos_puntos (recorrido, session, secuencial, p_latitud, p_longitud, timestamp, c_latitud, c_longitud)
                   select $1 as recorrido, $2 as session, p.*
                     from jsonb_to_recordset($3 :: jsonb) 
                       as p(secuencial integer, p_latitud decimal, p_longitud decimal, timestamp bigint, c_latitud decimal, c_longitud decimal);
                `,
                [parameters.recorrido, context.session.install||be.getMachineId(), JSON.stringify(parameters.puntos)]
            ).fetchOneRowIfExists();
            return result.rowCount;
        }
    },
    {
        action:'caso/guardar',
        parameters:[
            {name:'operativo'   , typeName:'text', references:'operativos'},
            {name:'id_caso'     , typeName:'text'      },
            {name:'datos_caso'  , typeName:'jsonb'     },
        ],
        definedIn: 'repsic',
        coreFunction:async function(context, parameters){
            var client=context.client;
            parameters.datos_caso['operativo'] = parameters.operativo;
            var queries = sqlTools.structuredData.sqlWrite(parameters.datos_caso, struct_grupo_personas);
            console.log("#############",queries)
            return await queries.reduce(function(promise, query){
                return promise.then(function() {
                    return client.query(query).execute().then(function(result){
                        return 'ok';
                    });
                });
            },Promise.resolve()).then(function(){
                return "ok";
            }).catch(function(err){
                console.log("ENTRA EN EL CATCH: ",err)
                throw err
            })
           
        }
    },
    {
        action: 'caso/traer',
        parameters: [
            {name:'operativo'     ,references:'operativos',  typeName:'text'},
            {name:'id_caso'       ,typeName:'text'},
        ],
        resultOk: 'goToEnc',
        definedIn: 'repsic',
        coreFunction: async function(context, parameters){
            var client=context.client;
            return client.query(
                sqlTools.structuredData.sqlRead({operativo: parameters.operativo, id_caso:parameters.id_caso}, struct_grupo_personas)
            ).fetchUniqueValue().then(function(result){
                var response = {};
                response['operativo'] = parameters.operativo;
                response['id_caso'] = parameters.id_caso;
                response['datos_caso'] = result.value;
                response['formulario'] = formPrincipal;
                return response;
            }).catch(function(err){
                console.log('ERROR',err.message);
                throw err;
            });
        }
    },
    {   
        action:'pasar/json2ua',
        parameters:[
        ],
        coreFunction:async function(context, parameters){
            /* GENERALIZAR: */
            var be=context.be;
            let mainTable=be.db.quoteIdent('grupo_personas');
            let operativo = 'REPSIC';
            /* FIN-GENERALIZAR: */
            let resultMain = await context.client.query(`SELECT * FROM ${mainTable} LIMIT 1`).fetchAll();
            if(resultMain.rowCount>0){
                console.log('HAY DATOS',resultMain.rows)
                throw new Error('HAY DATOS. NO SE PUEDE INICIAR EL PASAJE');
            }
            let resultJson = await context.client.query(
                `SELECT operativo, id_caso, datos_caso FROM formularios_json WHERE operativo=$1`,
                [operativo]
            ).fetchAll();
            var procedureGuardar = be.procedure['caso/guardar'];
            if(procedureGuardar.definedIn!='repsic'){
                throw new Error('hay que sobreescribir caso/guardar');
            }
            console.log('xxxxxxxxxxxxxx',resultJson.rows)
            return Promise.all(resultJson.rows.map(async function(row){
                await procedureGuardar.coreFunction(context, row)
                if(!('r4_esp' in row.datos_caso)){
                    row.datos_caso.r4_esp = null;
                }
                var {datos_caso, id_caso, operativo} = await be.procedure['caso/traer'].coreFunction(context, {operativo:row.operativo, id_caso:row.id_caso})
                var verQueGrabo = {datos_caso, id_caso, operativo}
                try{
                    discrepances.showAndThrow(verQueGrabo,row)
                }catch(err){
                    console.log(verQueGrabo,row)
                }
                return 'Ok!';
            })).catch(function(err){
                throw err;
            }).then(function(result){
                console.log('xxxxxxxx TERMINO LOS PROMISE.ALL')
                return result;
            })
        }
    },
    {   
        action:'calculadas/generar',
        parameters:[
            // {name:'operativo', typeName:'text', references:'operativos', }
        ],
        coreFunction:async function(context, parameters){
            parameters.operativo='REPSIC';
            var be=context.be;
            var db=be.db;
            be.sanitizarExpSql = function(x){ 
                if(typeof x === 'string' && /"'/.test(x)){
                    console.log('caracteres invalidos en expresion');
                    console.log(x);
                    throw new Error("caracteres invalidos en expresion")
                }
                if(typeof x !== 'string' && typeof x !== 'number' ){
                    console.log('tipo invalidos en expresion');
                    console.log(x);
                    throw new Error("tipo invalidos en expresion")
                }
                return x;
            };
            /* -------------- ESTO SE HACE UNA SOLA VEZ AL CERRAR, PASAR A CERRAR CUANDO LO HAGAMOS ------ */
            await context.client.query(
                `DELETE FROM variables_opciones op
                    WHERE EXISTS 
                        (SELECT variable FROM variables v 
                            WHERE v.operativo=op.operativo and v.variable=op.variable 
                                and v.clase='relevamiento' and v.operativo=$1)`
                ,[parameters.operativo]
            ).execute();
            await context.client.query(
                `DELETE FROM repsic.variables WHERE operativo = $1 and clase = 'relevamiento'`,
                [parameters.operativo]
            ).execute();
            await context.client.query(`INSERT INTO repsic.variables(
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
                INSERT INTO repsic.variables_opciones(
                        operativo, variable, opcion, nombre, orden)
                  select op.operativo, pre.var_name, casillero::integer,op.nombre, orden
                    from  pre join casilleros op on pre.operativo=op.operativo and pre.id_casillero=op.padre 
                    where pre.operativo=$1
                    order by orden_total, orden`
                , [parameters.operativo]               
            ).execute();    
            /* -------------- fin ESTO SE HACE UNA SOLA VEZ --------------------------------------------- */
            var drops=[];
            var creates=[];
            var inserts=[];
            var allPrefixedPks = {};
            var tableDefs={};
            var resTypeNameTipoVar= await context.client.query(`SELECT jsonb_object(array_agg(tipovar), array_agg(type_name)) 
                    FROM meta.tipovar                    
            `).fetchUniqueValue();
            var typeNameTipoVar=resTypeNameTipoVar.value;
            var resultUA = await context.client.query(`SELECT 
                   /* pk_padre debe ser el primer campo */
                   ${be.sqls.exprFieldUaPkPadre} as pk_padre, ua.*,
                   (select jsonb_agg(to_jsonb(v.*)) from variables v where v.operativo=ua.operativo and v.unidad_analisis=ua.unidad_analisis and v.clase='calculada' and v.activa) as variables
                FROM unidad_analisis ua
                WHERE operativo=$1
                ORDER BY 1
            `,[operativo]).fetchAll();
            resultUA.rows.forEach(function(row){
                var estParaGen = estructuraParaGenerar.tables[row.unidad_analisis];
                var tableName=estParaGen.target;
                drops.unshift("drop table if exists "+db.quoteIdent(tableName) + ";");
                var broDef = be.tableStructures[estParaGen.sourceBro](be.getContextForDump())
                var primaryKey=row.pk_padre.concat(row.pk_agregada);
                primaryKey.unshift('operativo'); // GENE              
                var prefixedPks = primaryKey.map(pk => row.unidad_analisis+'.'+pk);
                allPrefixedPks[row.unidad_analisis] = {
                    pks: prefixedPks,
                    pksString: prefixedPks.join(', ')
                }           
                var isAdmin = context.user.rol==='admin';
                var tableDefParteCtte={
                    name:tableName,
                    fields:broDef.fields.filter(field=>field.isPk).concat(
                        row.variables? (row.variables.map(v => {return {name:v.variable, typeName:typeNameTipoVar[v.tipovar], editable:false}}))
                        :[]
                    ),
                    editable:isAdmin,
                    primaryKey:primaryKey,
                    foreignKeys:[
                        {references:estParaGen.sourceBro, fields:primaryKey, onDelete:'cascade', displayAllFields:true}
                    ],
                    detailTables:estParaGen.detailTables,
                    sql:{
                        skipEnance:true,
                        isReferable: true
                    }
                }
                be.tableStructures[tableName]=tableDefs[tableName]=function(context){
                    return context.be.tableDefAdapt(tableDefParteCtte,context);
                };
                var pkString=primaryKey.join(', ');
                inserts.push(
                    "INSERT INTO "+db.quoteIdent(tableName)+" ("+pkString+") "+
                    "SELECT "+pkString+" FROM "+estParaGen.sourceBro+ ' '+ estParaGen.sourceJoin+";"
                )
            });
            var sqls = await be.dumpDbSchemaPartial(tableDefs, {});
            creates=creates.concat(sqls.mainSql).concat(sqls.enancePart);
            var allSqls=drops.concat(creates).concat(inserts)
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
            `,[operativo]).fetchAll();
            function wrapExpression(expression, pkExpression){
                var opts={language:'sql', varWrapper:'null2zero', divWrapper:'div0err', elseWrapper:'lanzar_error'};
                return VarCal.getWrappedExpression(expression, pkExpression, opts);
            }
            var variablesACalcular = variablesDatoResult.rows.map(function(v){
                let expresionValidada;
                var pkList = allPrefixedPks[v.unidad_analisis].pksString;
                if(v.opciones && v.opciones.length){
                    expresionValidada='CASE '+v.opciones.map(function(opcion){
                        return '\n          WHEN '+wrapExpression(opcion.expresion_condicion,pkList)+
                            ' THEN '+wrapExpression(opcion.expresion_valor||opcion.opcion,pkList)
                    }).join('')+(v.expresion?'\n          ELSE '+wrapExpression(v.expresion,pkList):'')+' END'
                }else{
                    expresionValidada = wrapExpression(v.expresion,pkList);
                }
                let insumos=VarCal.getInsumos(expresionValidada);
                return {
                    tabla:v.unidad_analisis, 
                    nombreVariable:v.variable, 
                    expresionValidada,
                    insumos,
                    funcion_agregacion: v.funcion_agregacion,
                    tabla_agregada: v.tabla_agregada
                }
            });
            var variablesDatoResult = await context.client.query(`
                SELECT variable, unidad_analisis, clase from variables
                WHERE operativo = $1 AND activa
            `,[operativo]).fetchAll();
            var allVariables = {};
            variablesDatoResult.rows.forEach(vDato=> allVariables[vDato.variable] = {tabla:vDato.unidad_analisis, clase: vDato.clase});
            likear(allPrefixedPks).forEach(function(prefixedPk, ua){
                prefixedPk.pks.forEach(pk => allVariables[pk] = {tabla:ua})
            });
            var grupoVariables=VarCal.separarEnGruposPorNivelYOrigen(variablesACalcular, Object.keys(likear(allVariables).filter(v=> v.clase != 'calculada')), estructuraParaGenerar);
            var parametrosGeneracion = {
                nombreFuncionGeneradora:'gen_fun_var_calc',
                esquema: be.config.db.schema,
            };
            var funcionGeneradora = VarCal.funcionGeneradora(grupoVariables, parametrosGeneracion, estructuraParaGenerar, allVariables);
            allSqls = ['do $SQL_DUMP$\n begin', "set search_path = "+be.config.db.schema+';'].concat(allSqls).concat(funcionGeneradora, 'perform gen_fun_var_calc();', 'end\n$SQL_DUMP$');
            let localMiroPorAhora = './local-miro-por-ahora.sql';
            var now=new Date();
            var todoElScript=allSqls.join('\n----\n')+'--- generado: '+now.toISOString()+'\n';
            fs.writeFileSync(localMiroPorAhora,todoElScript,{encoding:'utf8'})
            await context.client.query(todoElScript).execute();
            return 'generado !';
        }
    }
];

module.exports = ProceduresRepsic;