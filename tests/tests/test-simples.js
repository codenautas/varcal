"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discrepances = require("discrepances");
const MiniTools = require("mini-tools");
require("mocha");
const pg = require("pg-promise-strict");
const VarCal = require("../server/var-cal");
const var_cal_1 = require("../server/var-cal");
const app_varcal_1 = require("../server/app-varcal");
var config = {
    db: {
        motor: 'postgres',
        database: 'test_db',
        // schema: 'varcal', // TODO: ver después dónde se pone esto. 
        user: 'test_user',
        password: 'test_pass',
    }
};
// TODO pasar esto a otro archivo de mocks
// mock constants for general use
// let compilerOptionsMock: CompilerOptions = { language: 'sql', varWrapper: 'null2zero', divWrapper: 'div0err', elseWrapper: 'lanzar_error' };
// let allPrefixedPksMock: PrefixedPks = {
//     "grupo_personas": {
//         "pks": ["grupo_personas.operativo", "grupo_personas.id_caso"],
//         "pksString": "grupo_personas.operativo, grupo_personas.id_caso"
//     },
//     "personas": {
//         "pks":["personas.operativo", "personas.id_caso", "personas.p0"],
//         "pksString": "personas.operativo, personas.id_caso, personas.p0"
//     }
// };
// let variableDatoResultMock: VariableComplete[] = [
//     {
//         "operativo": "REPSIC",
//         "tabla_datos":"grupo_personas_calculada", "variable": "cant_f2", "abr": null, "nombre": "cantidad p", "tipovar": "numero",
//         "unidad_analisis": "grupo_personas", "clase": "calculada", "es_pk": null, "es_nombre_unico": null, "activa": true,
//         "filtro": null, "expresion": "true", "cascada": null, "nsnc_atipico": null, "cerrada": null, "funcion_agregacion": "contar",
//         "tabla_agregada": "personas", "grupo": "prueba", "orden": null, "opciones": null
//     }, {
//         "operativo": "REPSIC", "tabla_datos": "grupo_personas_calculada",
//         "variable": "con_cod_lugar", "abr": null, "nombre": null, "tipovar": "opciones", "unidad_analisis": "grupo_personas",
//         "clase": "calculada", "es_pk": null, "es_nombre_unico": null, "activa": true, "filtro": null, "expresion": null, "cascada": null,
//         "nsnc_atipico": null, "cerrada": null, "funcion_agregacion": null, "tabla_agregada": null, "grupo": "prueba", "orden": null,
//         "opciones": [
//             {
//                 "orden": 10, "nombre": "en lugar", "opcion": 1, "variable": "con_cod_lugar", "operativo": "REPSIC",
//                 "tabla_datos": "grupo_personas_calculada", "expresion_valor": null,
//                 "expresion_condicion": "o2 = 6 or o2 = 7 or o2 = 8"
//             },
//             {
//                 "orden": 20, "nombre": "sin lugar", "opcion": 2, "variable": "con_cod_lugar", "operativo": "REPSIC", "tabla_datos": "grupo_personas_calculada",
//                 "expresion_valor": null, "expresion_condicion": "o2<6 or o2>8"
//             }]
//     }, 
//     {
//         "operativo": "REPSIC", "tabla_datos": "grupo_personas_calculada", "variable": "suma_edad", "abr": null, "nombre": "suma edades", "tipovar": "numero",
//         "unidad_analisis": "grupo_personas", "clase": "calculada", "es_pk": null, "es_nombre_unico": null, "activa": true, "filtro": null, "expresion": "p3",
//         "cascada": null, "nsnc_atipico": null, "cerrada": null, "funcion_agregacion": "sumar", "tabla_agregada": "personas", "grupo": "prueba", "orden": null,
//         "opciones": null
//     }
// ]
describe("varcal", function () {
    var client;
    before(async function () {
        this.timeout(50000);
        config = await MiniTools.readConfig([config, 'src/tests/local-config'], { whenNotExist: 'ignore' });
        var client = await pg.connect(config.db);
        await client.executeSqlScript('src/tests/fixtures/initial_db.sql');
        console.log('system ready');
    });
    //     describe("sentenciaUpdate", function () {
    //         it("genera un update basado en 2 variables", async function () {
    //             var sqlGenerado = VarCal.sentenciaUpdate({
    //                 tabla: 't1',
    //                 variables: [{
    //                     nombreVariable: 'x',
    //                     expresionValidada: 'dato1 * 2 + dato2'
    //                 }, {
    //                     nombreVariable: 'pepe',
    //                     expresionValidada: 'f(j)'
    //                 }]
    //             }, 2)
    //             var sentenciaEsperada = '  UPDATE t1\n    SET x = dato1 * 2 + dato2,\n        pepe = f(j)';
    //             discrepances.showAndThrow(sqlGenerado, sentenciaEsperada);
    //             this.timeout(50000);
    //         });
    //         it("genera un update basado en 2 variables agregando prefijos a todas las variables de la expresionValidada", async function () {
    //             var sqlGenerado = VarCal.sentenciaUpdate({
    //                 tabla: 't1',
    //                 variables: [{
    //                     nombreVariable: 'x',
    //                     expresionValidada: 'dato1 * 2 + dato2',
    //                     insumos:{variables:['dato1', 'dato2'], aliases:[], funciones:[]}
    //                 }, {
    //                     nombreVariable: 'pepe',
    //                     expresionValidada: 'f(j)',
    //                     insumos:{variables:['j'],aliases:[], funciones:[]}
    //                 }]
    //             }, 2, {tables:{t1:{
    //                     operativo: 'repsic',
    //                     target: 't1_calculada',
    //                     sourceJoin: 'inner join t0 using(pk0)',
    //                     sourceBro: 't1',
    //                     where: 't1_calculada.t1 = t1.t1 and t1_calculada.pk0=t0.pk0',
    //             }}},{
    //                 dato1:{tabla:'t1'},
    //                 dato2:{tabla:'t1', clase:'calculada'},
    //                 j:{tabla:'t1'},
    //             })
    //             var sentenciaEsperada = '  UPDATE t1_calculada\n    SET x = t1.dato1 * 2 + t1_calculada.dato2,\n        pepe = f(t1.j)\n    FROM t1 inner join t0 using(pk0)\n    WHERE t1_calculada.t1 = t1.t1 and t1_calculada.pk0=t0.pk0';
    //             discrepances.showAndThrow(sqlGenerado, sentenciaEsperada);
    //             this.timeout(50000);
    //         });
    //         it("genera un update basado en 2 variables con definition structure", async function () {
    //             var sqlGenerado = VarCal.sentenciaUpdate({
    //                 tabla: 't1',
    //                 variables: [{
    //                     nombreVariable: 'x',
    //                     expresionValidada: 'dato1 * 2 + dato2'
    //                 }, {
    //                     nombreVariable: 'pepe',
    //                     expresionValidada: 'f(j)'
    //                 }]
    //             }, 2, {
    //                     tables: {
    //                         t1: {
    //                             operativo: 'repsic',
    //                             target: 't1_calculada',
    //                             sourceJoin: 'inner join t0 using(pk0)',
    //                             sourceBro: 't1',
    //                             where: 't1_calculada.t1 = t1.t1 and t1_calculada.pk0=t0.pk0',
    //                         }
    //                     }
    //                 })
    //             var sentenciaEsperada = '  UPDATE t1_calculada\n    SET x = dato1 * 2 + dato2,\n        pepe = f(j)\n    FROM t1 inner join t0 using(pk0)\n    WHERE t1_calculada.t1 = t1.t1 and t1_calculada.pk0=t0.pk0';
    //             discrepances.showAndThrow(sqlGenerado, sentenciaEsperada);
    //             this.timeout(50000);
    //         });
    //         it("genera un update basado en 2 variables cuyos insumos pertenecen a un alias, con definition structure", async function () {
    //             var sqlGenerado = VarCal.sentenciaUpdate({
    //                 tabla: 'personas',
    //                 variables: [{
    //                     nombreVariable: 'x', expresionValidada: 'ingreso * 2 + ingreso2', insumos: { variables: ['ingreso', 'ingreso2'], aliases: [], funciones:[] }
    //                 }, {
    //                     nombreVariable: 'dif_edad_padre', expresionValidada: 'padre.edad - edad', insumos: { variables: ['padre.edad', 'edad'], aliases: ['padre'], funciones:[] }
    //                 }]
    //             }, 14, {
    //                     aliases: {
    //                         padre: {
    //                             tabla_datos: 'personas',
    //                             on: 'padre.id = personas.id AND padre.p0 = personas.p11',
    //                         }
    //                     },
    //                     tables: {
    //                         personas: {
    //                             operativo: 'repsic',
    //                             target: 'personas_calculada',
    //                             sourceJoin: 'inner join t0 using(pk0)',
    //                             sourceBro: 'personas',
    //                             where: 'personas_calculada.id = personas.id and personas_calculada.pk0=t0.pk0',
    //                             pks:['operativo', 'id_caso']
    //                         }
    //                     }
    //                 })
    //             var sentenciaEsperada =
    //                 `              UPDATE personas_calculada
    //                 SET x = ingreso * 2 + ingreso2,
    //                     dif_edad_padre = padre.edad - edad
    //                 FROM personas inner join t0 using(pk0)
    //                     LEFT JOIN (
    //                         SELECT operativo, id_caso, padre.edad
    //                           FROM personas padre
    //                     ) padre ON padre.id = personas.id AND padre.p0 = personas.p11
    //                 WHERE personas_calculada.id = personas.id and personas_calculada.pk0=t0.pk0`;
    //             discrepances.showAndThrow(sqlGenerado, sentenciaEsperada);
    //             this.timeout(50000);
    //         });
    //         it("genera un update basado en variables de otras tablas", async function () {
    //             var sqlGenerado = VarCal.sentenciaUpdate({
    //                 tabla: 't1',
    //                 variables: [{
    //                     nombreVariable: 'x',
    //                     expresionValidada: 'dato1 * 2 + dato2',
    //                 }],
    //                 joins: [{
    //                     tabla: 't2',
    //                     clausulaJoin: 't2.id = t1.id'
    //                 }, {
    //                     tabla: 't3',
    //                     clausulaJoin: 't2.id = t1.id and t2.id=t3.id'
    //                 }]
    //             }, 1);
    //             var sentenciaEsperada =
    //                 ` UPDATE t1
    //    SET x = dato1 * 2 + dato2
    //    FROM t2, t3
    //    WHERE t2.id = t1.id
    //      AND t2.id = t1.id and t2.id=t3.id`;
    //             discrepances.showAndThrow(sqlGenerado, sentenciaEsperada);
    //         });
    //     });
    //     describe("sentenciaUpdate agregada", function () {
    //         it("genera un update basado en 2 variables con definition structure con funciones de agregación", async function () {
    //             var sqlGenerado = VarCal.sentenciaUpdate({
    //                 tabla: 'hogares',
    //                 variables: [{
    //                     nombreVariable: 'cantidad_mujeres',
    //                     expresionValidada: 'sexo=2',
    //                     funcion_agregacion: 'contar',
    //                     tabla_agregada: 'personas'
    //                 }, {
    //                     nombreVariable: 'cant_revisitas',
    //                     expresionValidada: 'true',
    //                     funcion_agregacion: 'contar',
    //                     tabla_agregada: 'visitas'
    //                 }, {
    //                     nombreVariable: 'ingresos_hogar',
    //                     expresionValidada: 'ingreso_personal',
    //                     funcion_agregacion: 'sumar',
    //                     tabla_agregada: 'personas'
    //                 }, {
    //                     nombreVariable: 'tres',
    //                     expresionValidada: 'uno+dos'
    //                 }],
    //             }, 14, {
    //                     tables: {
    //                         hogares: {
    //                             operativo: 'repsic',
    //                             target: 'hogares_calculada',
    //                             sourceJoin: 'inner join viviendas using(v)',
    //                             sourceBro: 'hogares',
    //                             where: 'hogares_calculada.h = hogares.h and hogares_calculada.v=hogares.v',
    //                         },
    //                         personas: {
    //                             operativo: 'repsic',
    //                             aliasAgg: 'personas_agg',
    //                             sourceAgg: 'personas_calculada inner join personas USING (v, h, p)',
    //                             whereAgg:{ 
    //                                 hogares: 'personas_calculada.h = hogares.h and personas_calculada.v = hogares.v'
    //                             }    
    //                         },
    //                         visitas: {
    //                             operativo: 'repsic',
    //                             aliasAgg: 'visitas_agg',
    //                             sourceAgg: 'visitas',
    //                             whereAgg:{
    //                                 hogares: 'visitas.h = hogares.h and visitas.v = hogares.v'
    //                             }    
    //                         }
    //                     }
    //                 })
    //             var sentenciaEsperada =
    //                 `              UPDATE hogares_calculada
    //                 SET cantidad_mujeres = personas_agg.cantidad_mujeres,
    //                     cant_revisitas = visitas_agg.cant_revisitas,
    //                     ingresos_hogar = personas_agg.ingresos_hogar,
    //                     tres = uno+dos
    //                 FROM hogares inner join viviendas using(v), 
    //                   LATERAL (
    //                     SELECT
    //                         count(nullif(sexo=2,false)) as cantidad_mujeres,
    //                         sum(ingreso_personal) as ingresos_hogar
    //                       FROM personas_calculada inner join personas USING (v, h, p)
    //                       WHERE personas_calculada.h = hogares.h and personas_calculada.v = hogares.v
    //                   ) personas_agg, 
    //                   LATERAL (
    //                     SELECT
    //                         count(nullif(true,false)) as cant_revisitas
    //                       FROM visitas
    //                       WHERE visitas.h = hogares.h and visitas.v = hogares.v
    //                   ) visitas_agg
    //                 WHERE hogares_calculada.h = hogares.h and hogares_calculada.v=hogares.v`;
    //             discrepances.showAndThrow(sqlGenerado, sentenciaEsperada);
    //             this.timeout(50000);
    //         });
    //     });
    //     describe("prueba get Insumos", function () {
    //         it("genera funciones y variales", function () {
    //             let expectedInsumos: Insumos = { variables: ['a', 't.c'], aliases: ['t'], funciones: ['f', 'max'] }
    //             discrepances.showAndThrow(VarCal.getInsumos('a + t.c AND f(max(a, t.c))'), expectedInsumos);
    //         });
    //     });
    //     describe("funcionGeneradora", function () {
    //         it("genera función simple", async function () {
    //             var funcionGenerada = VarCal.funcionGeneradora([{
    //                 tabla: 'datos',
    //                 variables: [{
    //                     nombreVariable: 'doble_y_suma', expresionValidada: 'dato1 * 2 + dato2'
    //                 }],
    //             }, {
    //                 tabla: 'datos',
    //                 variables: [{
    //                     nombreVariable: 'cal1', expresionValidada: 'doble_y_suma + dato1'
    //                 }, {
    //                     nombreVariable: 'cal2', expresionValidada: 'doble_y_suma + dato2'
    //                 }],
    //             }],
    //                 {
    //                     nombreFuncionGeneradora: 'gen_fun',
    //                     esquema: 'test_varcal'
    //                 }, {
    //                     tables: {
    //                         datos: {
    //                             operativo: 'repsic',
    //                             target: 't1_calculada',
    //                             sourceJoin: 'inner join t0 using(pk0)',
    //                             sourceBro: 't1',
    //                             where: 't1_calculada.t1 = t1.t1 and t1_calculada.pk0=t0.pk0',
    //                         }
    //                     }
    //                 });
    //             var funcionEsperada = await fs.readFile('./src/tests/fixtures/first-generated-fun.sql', { encoding: 'UTF8' });
    //             discrepances.showAndThrow(funcionGenerada, funcionEsperada);
    //         });
    //     });
    //     describe("funcionGeneradora", function () {
    //         it("genera función compleja", async function () {
    //             var funcionGenerada = VarCal.funcionGeneradora([{
    //                 tabla: 'datos',
    //                 variables: [{
    //                     nombreVariable: 'doble_y_suma', expresionValidada: 'dato1 * 2 + dato2'
    //                 }],
    //             }, {
    //                 tabla: 'datos2',
    //                 variables: [{
    //                     nombreVariable: 'cal1', expresionValidada: 'doble_y_suma + dato1'
    //                 }, {
    //                     nombreVariable: 'cal2', expresionValidada: 'doble_y_suma + dato2'
    //                 }],
    //             }],
    //                 {
    //                     nombreFuncionGeneradora: 'gen_fun',
    //                     esquema: 'test_varcal'
    //                 }, {
    //                     tables: {
    //                         datos: {
    //                             operativo: 'repsic',
    //                             target: 't1_calculada',
    //                             sourceJoin: 'inner join t0 using(pk0)',
    //                             sourceBro: 't1',
    //                             where: 't1_calculada.t1 = datos.t1 and t1_calculada.pk0=t0.pk0',
    //                         },
    //                         datos2: {
    //                             operativo: 'repsic',
    //                             target: 't2_calculada',
    //                             sourceJoin: 'inner join t0 using(pk0) join t1_calculada using(pk0)',
    //                             sourceBro: 't2',
    //                             where: 't2_calculada.t2 = datos2.t2 and t2_calculada.pk0=t0.pk0 and t2_calculada.pk0=t1_calculada.pk0',
    //                         }
    //                     }
    //                 });
    //             var funcionEsperada = await fs.readFile('./src/tests/fixtures/second-generated-fun.sql', { encoding: 'UTF8' });
    //             discrepances.showAndThrow(funcionGenerada, funcionEsperada);
    //         });
    //     });
    //     describe("getVariablesACalcular", function () {
    //         it("devuelve las variables a calcular", function () {
    //             let varsToCalculate = VarCal.getVariablesACalcular(variableDatoResultMock, allPrefixedPksMock, compilerOptionsMock)
    //             let expectedVars: VariableGenerable[] = [{
    //                 "tabla": "grupo_personas",
    //                 "nombreVariable": "cant_f2", "expresionValidada": "true", "funcion_agregacion": "contar", "tabla_agregada": "personas",
    //                 "insumos": { "variables": [], "aliases": [], "funciones": [] }
    //             },
    //             {
    //                 "tabla": "grupo_personas",
    //                 "nombreVariable": "con_cod_lugar",
    //                 "expresionValidada": "CASE \n          WHEN null2zero(o2) = 6 or null2zero(o2) = 7 or null2zero(o2) = 8 THEN 1\n          WHEN null2zero(o2) < 6 or null2zero(o2) > 8 THEN 2 END",
    //                 "funcion_agregacion": null, 
    //                 "tabla_agregada": null,
    //                 "insumos": { "variables": ["o2"], "aliases": [], "funciones": ["null2zero"] }
    //             }, {
    //                 "tabla": "grupo_personas",
    //                 "nombreVariable": "suma_edad", "expresionValidada": "null2zero(p3)", "funcion_agregacion": "sumar", "tabla_agregada": "personas", 
    //                 "insumos": { "variables": ["p3"], "aliases": [], "funciones": ["null2zero"] }
    //             }]
    //             discrepances.showAndThrow(varsToCalculate, expectedVars);
    //         });
    //     });
    describe("calcularNiveles", function () {
        it("separa en listas por nivel", async function () {
            var resultadoNiveles = VarCal.separarEnGruposPorNivelYOrigen([
                { operativo: 'd', clase: 'calculada', tabla_datos: 'datos', variable: 'doble_y_suma', expresionValidada: 'dato1 * 2 + dato2', insumos: { variables: ['dato1', 'dato2'], aliases: [], funciones: [] }, tipovar: 'a' },
                { operativo: 'd', clase: 'calculada', tabla_datos: 'datos', variable: 'cal1', expresionValidada: 'doble_y_suma + dato1', insumos: { variables: ['doble_y_suma', 'dato1'], aliases: [], funciones: [] }, tipovar: 'a' },
                { operativo: 'd', clase: 'calculada', tabla_datos: 'datos', variable: 'cal2', expresionValidada: 'doble_y_suma + dato2', insumos: { variables: ['doble_y_suma', 'dato2'], aliases: [], funciones: [] }, tipovar: 'a' }
            ].map((v) => app_varcal_1.VariableCalculada.buildFromDBJSON(v)), ['dato1', 'dato2']);
            var listaEsperada = [Object.setPrototypeOf({
                    tabla: 'datos',
                    variables: [Object.setPrototypeOf({
                            operativo: 'd', clase: 'calculada', tabla_datos: 'datos', variable: 'doble_y_suma', expresionValidada: 'dato1 * 2 + dato2', insumos: { variables: ['dato1', 'dato2'], aliases: [], funciones: [] }, tipovar: 'a'
                        }, app_varcal_1.VariableCalculada.prototype)],
                }, var_cal_1.BloqueVariablesACalcular.prototype), Object.setPrototypeOf({
                    tabla: 'datos',
                    variables: [Object.setPrototypeOf({
                            operativo: 'd', clase: 'calculada', tabla_datos: 'datos', variable: 'cal1', expresionValidada: 'doble_y_suma + dato1', insumos: { variables: ['doble_y_suma', 'dato1'], aliases: [], funciones: [] }, tipovar: 'a'
                        }, app_varcal_1.VariableCalculada.prototype), Object.setPrototypeOf({
                            operativo: 'd', clase: 'calculada', tabla_datos: 'datos', variable: 'cal2', expresionValidada: 'doble_y_suma + dato2', insumos: { variables: ['doble_y_suma', 'dato2'], aliases: [], funciones: [] }, tipovar: 'a'
                        }, app_varcal_1.VariableCalculada.prototype)],
                }, var_cal_1.BloqueVariablesACalcular.prototype)];
            discrepances.showAndThrow(resultadoNiveles, listaEsperada);
        });
        it("separa en listas por nivel con orden inverso", async function () {
            var resultadoNiveles = VarCal.separarEnGruposPorNivelYOrigen([
                Object.setPrototypeOf({ tabla_datos: 'datos', variable: 'cal0', expresionValidada: 'doble_y_suma + cal1', insumos: { variables: ['doble_y_suma', 'cal1'], aliases: [], funciones: [] } }, app_varcal_1.VariableCalculada.prototype),
                Object.setPrototypeOf({ tabla_datos: 'datos', variable: 'cal1', expresionValidada: 'doble_y_suma + dato1', insumos: { variables: ['doble_y_suma', 'dato1'], aliases: [], funciones: [] } }, app_varcal_1.VariableCalculada.prototype),
                Object.setPrototypeOf({ tabla_datos: 'datos', variable: 'cal2', expresionValidada: 'doble_y_suma + dato2', insumos: { variables: ['doble_y_suma', 'dato2'], aliases: [], funciones: [] } }, app_varcal_1.VariableCalculada.prototype),
                Object.setPrototypeOf({ tabla_datos: 'datos', variable: 'doble_y_suma', expresionValidada: 'dato1 * 2 + dato2', insumos: { variables: ['dato1', 'dato2'], aliases: [], funciones: [] } }, app_varcal_1.VariableCalculada.prototype)
            ], ['dato1', 'dato2']);
            var listaEsperada = [Object.setPrototypeOf({
                    tabla: 'datos',
                    variables: [Object.setPrototypeOf({
                            tabla_datos: 'datos', variable: 'doble_y_suma', expresionValidada: 'dato1 * 2 + dato2', insumos: { variables: ['dato1', 'dato2'], aliases: [], funciones: [] }
                        }, app_varcal_1.VariableCalculada.prototype)],
                }, var_cal_1.BloqueVariablesACalcular.prototype), Object.setPrototypeOf({
                    tabla: 'datos',
                    variables: [Object.setPrototypeOf({
                            tabla_datos: 'datos', variable: 'cal1', expresionValidada: 'doble_y_suma + dato1', insumos: { variables: ['doble_y_suma', 'dato1'], aliases: [], funciones: [] }
                        }, app_varcal_1.VariableCalculada.prototype), Object.setPrototypeOf({
                            tabla_datos: 'datos', variable: 'cal2', expresionValidada: 'doble_y_suma + dato2', insumos: { variables: ['doble_y_suma', 'dato2'], aliases: [], funciones: [] }
                        }, app_varcal_1.VariableCalculada.prototype)],
                }, var_cal_1.BloqueVariablesACalcular.prototype), Object.setPrototypeOf({
                    tabla: 'datos',
                    variables: [Object.setPrototypeOf({
                            tabla_datos: 'datos', variable: 'cal0', expresionValidada: 'doble_y_suma + cal1', insumos: { variables: ['doble_y_suma', 'cal1'], aliases: [], funciones: [] }
                        }, app_varcal_1.VariableCalculada.prototype)],
                }, var_cal_1.BloqueVariablesACalcular.prototype)];
            discrepances.showAndThrow(resultadoNiveles, listaEsperada);
        });
        it("separa en listas por nivel usando alias", async function () {
            var resultadoNiveles = VarCal.separarEnGruposPorNivelYOrigen([
                Object.setPrototypeOf({ tabla_datos: 'datos', variable: 'doble_y_suma', expresionValidada: 'dato1 * 2 + dato2', insumos: { variables: ['dato1', 'dato2'], aliases: [], funciones: [] } }, app_varcal_1.VariableCalculada.prototype),
                Object.setPrototypeOf({ tabla_datos: 'personas', variable: 'dif_edad_padre', expresionValidada: 'padre.p3 - p3', insumos: { variables: ['padre.p3', 'p3'], aliases: ['padre'], funciones: [] } }, app_varcal_1.VariableCalculada.prototype)
            ], ['p3', 'dato1', 'dato2'], {
                aliases: {
                    padre: {
                        tabla_datos: 'personas',
                        on: 'padre.id_caso = personas.id_caso AND padre.p0 = personas.p11 AND padre.operativo = personas.operativo',
                    }
                },
                tables: {}
            });
            var listaEsperada = [Object.setPrototypeOf({
                    tabla: 'datos',
                    variables: [Object.setPrototypeOf({
                            tabla_datos: 'datos', variable: 'doble_y_suma', expresionValidada: 'dato1 * 2 + dato2', insumos: { variables: ['dato1', 'dato2'], aliases: [], funciones: [] }
                        }, app_varcal_1.VariableCalculada.prototype)],
                }, var_cal_1.BloqueVariablesACalcular.prototype), Object.setPrototypeOf({
                    tabla: 'personas',
                    variables: [Object.setPrototypeOf({
                            tabla_datos: 'personas', variable: 'dif_edad_padre', expresionValidada: 'padre.p3 - p3', insumos: { variables: ['padre.p3', 'p3'], aliases: ['padre'], funciones: [] }
                        }, app_varcal_1.VariableCalculada.prototype)],
                }, var_cal_1.BloqueVariablesACalcular.prototype)];
            discrepances.showAndThrow(resultadoNiveles, listaEsperada);
        });
        it("separa en listas por nivel que usa prefijos de tablas (no de aliases), por ej unidades de análisis con wrappers", async function () {
            var resultadoNiveles = VarCal.separarEnGruposPorNivelYOrigen([
                Object.setPrototypeOf({ tabla_datos: 'datos', variable: 'promedio_edad', expresionValidada: 'div0err(null2zero(suma_edad), null2zero(cant_f2), grupo_personas.operativo, grupo_personas.id_caso)', insumos: { variables: ['suma_edad', 'cant_f2', 'grupo_personas.operativo', 'grupo_personas.id_caso'], aliases: ['grupo_personas'], funciones: ['div0err', 'null2zero'] } }, app_varcal_1.VariableCalculada.prototype),
            ], ['suma_edad', 'cant_f2', 'operativo', 'id_caso'], {
                tables: {
                    grupo_personas: {}
                }
            });
            var listaEsperada = [Object.setPrototypeOf({
                    tabla: 'datos',
                    variables: [Object.setPrototypeOf({
                            tabla_datos: 'datos', variable: 'promedio_edad', expresionValidada: 'div0err(null2zero(suma_edad), null2zero(cant_f2), grupo_personas.operativo, grupo_personas.id_caso)', insumos: { variables: ['suma_edad', 'cant_f2', 'grupo_personas.operativo', 'grupo_personas.id_caso'], aliases: ['grupo_personas'], funciones: ['div0err', 'null2zero'] }
                        }, app_varcal_1.VariableCalculada.prototype)],
                }, var_cal_1.BloqueVariablesACalcular.prototype)];
            discrepances.showAndThrow(resultadoNiveles, listaEsperada);
        });
        it("protesta si no se puede por abrazo mortal", async function () {
            try {
                VarCal.separarEnGruposPorNivelYOrigen([
                    Object.setPrototypeOf({ tabla_datos: 'datos', variable: 'a', expresionValidada: 'b', insumos: { variables: ['b'], aliases: [], funciones: [] } }, app_varcal_1.VariableCalculada.prototype),
                    Object.setPrototypeOf({ tabla_datos: 'datos', variable: 'b', expresionValidada: 'a', insumos: { variables: ['a'], aliases: [], funciones: [] } }, app_varcal_1.VariableCalculada.prototype),
                ], ['dato1', 'dato2']);
                throw new Error('Tenía que dar error por abrazo mortal');
            }
            catch (err) {
                discrepances.showAndThrow(err.message, "Error, no se pudo determinar el orden de la variable 'a' y otras");
            }
            this.timeout(50000);
        });
        it("protesta si no se puede porque no encuentra el prefijo en la definición estructural", async function () {
            try {
                VarCal.separarEnGruposPorNivelYOrigen([
                    Object.setPrototypeOf({ tabla_datos: 'datos', variable: 'a', expresionValidada: 'prefix_alias.dato2 + 4', insumos: { variables: ['prefix_alias.dato2'], aliases: ['prefix_alias'], funciones: [] } }, app_varcal_1.VariableCalculada.prototype),
                ], ['dato1', 'dato2']);
                throw new Error('Tenía que dar error por abrazo mortal');
            }
            catch (err) {
                discrepances.showAndThrow(err.message, "Error, no se pudo determinar el orden de la variable 'a' y otras");
            }
            this.timeout(50000);
        });
        it("separa en listas por nivel", async function () {
            var resultadoNiveles = VarCal.separarEnGruposPorNivelYOrigen([
                Object.setPrototypeOf({ tabla_datos: 'datos', variable: 'doble_y_suma', expresionValidada: 'dato1 * 2 + dato2', insumos: { variables: ['dato1', 'dato2'], aliases: [], funciones: [] } }, app_varcal_1.VariableCalculada.prototype),
                Object.setPrototypeOf({ tabla_datos: 'datos', variable: 'cal1', expresionValidada: 'doble_y_suma + dato1', insumos: { variables: ['doble_y_suma', 'dato1'], aliases: [], funciones: [] } }, app_varcal_1.VariableCalculada.prototype),
                Object.setPrototypeOf({ tabla_datos: 'datos', variable: 'cal2', expresionValidada: 'doble_y_suma + dato2', insumos: { variables: ['doble_y_suma', 'dato2'], aliases: [], funciones: [] } }, app_varcal_1.VariableCalculada.prototype),
                Object.setPrototypeOf({ tabla_datos: 'datos', variable: 'cal3', expresionValidada: 'doble_y_suma + dato2', insumos: { variables: ['doble_y_suma', 'dato2'], aliases: [], funciones: [] } }, app_varcal_1.VariableCalculada.prototype),
            ], ['dato1', 'dato2']);
            var listaEsperada = [Object.setPrototypeOf({
                    tabla: 'datos',
                    variables: [Object.setPrototypeOf({
                            tabla_datos: 'datos', variable: 'doble_y_suma', expresionValidada: 'dato1 * 2 + dato2', insumos: { variables: ['dato1', 'dato2'], aliases: [], funciones: [] }
                        }, app_varcal_1.VariableCalculada.prototype)],
                }, var_cal_1.BloqueVariablesACalcular.prototype), Object.setPrototypeOf({
                    tabla: 'datos',
                    variables: [Object.setPrototypeOf({
                            tabla_datos: 'datos', variable: 'cal1', expresionValidada: 'doble_y_suma + dato1', insumos: { variables: ['doble_y_suma', 'dato1'], aliases: [], funciones: [] }
                        }, app_varcal_1.VariableCalculada.prototype),
                        Object.setPrototypeOf({
                            tabla_datos: 'datos', variable: 'cal2', expresionValidada: 'doble_y_suma + dato2', insumos: { variables: ['doble_y_suma', 'dato2'], aliases: [], funciones: [] }
                        }, app_varcal_1.VariableCalculada.prototype),
                        Object.setPrototypeOf({
                            tabla_datos: 'datos', variable: 'cal3', expresionValidada: 'doble_y_suma + dato2', insumos: { variables: ['doble_y_suma', 'dato2'], aliases: [], funciones: [] }
                        }, app_varcal_1.VariableCalculada.prototype)
                    ]
                }, var_cal_1.BloqueVariablesACalcular.prototype)];
            discrepances.showAndThrow(resultadoNiveles, listaEsperada);
            this.timeout(50000);
        });
        it("separa con dependencias complejas", async function () {
            var resultadoNiveles = VarCal.separarEnGruposPorNivelYOrigen([
                Object.setPrototypeOf({ tabla_datos: 'datos', variable: 'abbaab', expresionValidada: 'abb+aab', insumos: { variables: ['aab', 'abb'], aliases: [], funciones: [] } }, app_varcal_1.VariableCalculada.prototype),
                Object.setPrototypeOf({ tabla_datos: 'datos', variable: 'a', expresionValidada: 'o', insumos: { variables: [], aliases: [], funciones: [] } }, app_varcal_1.VariableCalculada.prototype),
                Object.setPrototypeOf({ tabla_datos: 'equis', variable: 'ab', expresionValidada: 'a+b', insumos: { variables: ['a', 'b'], aliases: [], funciones: [] } }, app_varcal_1.VariableCalculada.prototype),
                // {tabla:'datos', variable:'aa'    , expresionValidada:'a+a'    , insumos:{variables:['a'],aliases:[], funciones:[]}}, 
                Object.setPrototypeOf({ tabla_datos: 'datos', variable: 'aab', expresionValidada: 'a+ab', insumos: { variables: ['a', 'ab'], aliases: [], funciones: [] } }, app_varcal_1.VariableCalculada.prototype),
                Object.setPrototypeOf({ tabla_datos: 'datos', variable: 'b', expresionValidada: 'o', insumos: { variables: ['o'], aliases: [], funciones: [] } }, app_varcal_1.VariableCalculada.prototype),
                Object.setPrototypeOf({ tabla_datos: 'datos', variable: 'abb', expresionValidada: 'ab+b', insumos: { variables: ['ab', 'b'], aliases: [], funciones: [] } }, app_varcal_1.VariableCalculada.prototype),
            ], ['o']);
            var listaEsperada = [
                Object.setPrototypeOf({
                    tabla: 'datos',
                    variables: [
                        Object.setPrototypeOf({ tabla_datos: 'datos', variable: 'a', expresionValidada: 'o', insumos: { variables: [], aliases: [], funciones: [] } }, app_varcal_1.VariableCalculada.prototype),
                        Object.setPrototypeOf({ tabla_datos: 'datos', variable: 'b', expresionValidada: 'o', insumos: { variables: ['o'], aliases: [], funciones: [] } }, app_varcal_1.VariableCalculada.prototype),
                    ],
                }, var_cal_1.BloqueVariablesACalcular.prototype), Object.setPrototypeOf({
                    tabla: 'equis',
                    variables: [
                        Object.setPrototypeOf({ tabla_datos: 'equis', variable: 'ab', expresionValidada: 'a+b', insumos: { variables: ['a', 'b'], aliases: [], funciones: [] } }, app_varcal_1.VariableCalculada.prototype),
                    ],
                }, var_cal_1.BloqueVariablesACalcular.prototype), Object.setPrototypeOf({
                    tabla: 'datos',
                    variables: [
                        Object.setPrototypeOf({ tabla_datos: 'datos', variable: 'aab', expresionValidada: 'a+ab', insumos: { variables: ['a', 'ab'], aliases: [], funciones: [] } }, app_varcal_1.VariableCalculada.prototype),
                        Object.setPrototypeOf({ tabla_datos: 'datos', variable: 'abb', expresionValidada: 'ab+b', insumos: { variables: ['ab', 'b'], aliases: [], funciones: [] } }, app_varcal_1.VariableCalculada.prototype),
                    ],
                }, var_cal_1.BloqueVariablesACalcular.prototype), Object.setPrototypeOf({
                    tabla: 'datos',
                    variables: [
                        Object.setPrototypeOf({ tabla_datos: 'datos', variable: 'abbaab', expresionValidada: 'abb+aab', insumos: { variables: ['aab', 'abb'], aliases: [], funciones: [] } }, app_varcal_1.VariableCalculada.prototype),
                    ],
                }, var_cal_1.BloqueVariablesACalcular.prototype)
            ];
            discrepances.showAndThrow(resultadoNiveles, listaEsperada);
            this.timeout(50000);
        });
    });
    after(async function () {
        client.done();
    });
});
process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});
//# sourceMappingURL=test-simples.js.map