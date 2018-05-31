import * as MiniTools from 'mini-tools';
import * as discrepances from 'discrepances';
import * as pg from 'pg-promise-strict';
import * as fs from 'fs-extra';

import 'mocha';

import * as VarCal from '../src/var-cal';

(pg as { easy: boolean }).easy = true;

var config = {
    db: {
        motor: 'postgres',
        database: 'test_db',
        schema: 'varcal',
        user: 'test_user',
        password: 'test_pass',
    }
}

describe("varcal", function () {
    var client: pg.Client;
    before(async function () {
        this.timeout(50000);
        config = await MiniTools.readConfig(
            [config, 'test/local-config'],
            { whenNotExist: 'ignore' }
        ) as typeof config;
        client = await pg.connect(config.db);
        await client.executeSqlScript('test/fixtures/initial_db.sql');
        console.log('system ready');
    });
    describe("sentenciaUpdate", function () {
        it("genera un update basado en 2 variables", async function () {
            var sqlGenerado = VarCal.sentenciaUpdate({
                tabla: 't1',
                variables: [{
                    nombreVariable: 'x',
                    expresionValidada: 'dato1 * 2 + dato2'
                }, {
                    nombreVariable: 'pepe',
                    expresionValidada: 'f(j)'
                }]
            }, 2)
            var sentenciaEsperada = '  UPDATE t1\n    SET x = dato1 * 2 + dato2,\n        pepe = f(j)';
            discrepances.showAndThrow(sqlGenerado, sentenciaEsperada);
            this.timeout(50000);
        });
        it("genera un update basado en 2 variables agregando prefijos a todas las variables de la expresionValidada", async function () {
            var sqlGenerado = VarCal.sentenciaUpdate({
                tabla: 't1',
                variables: [{
                    nombreVariable: 'x',
                    expresionValidada: 'dato1 * 2 + dato2',
                    insumos:{variables:['dato1', 'dato2']}
                }, {
                    nombreVariable: 'pepe',
                    expresionValidada: 'f(j)',
                    insumos:{variables:['j']}
                }]
            }, 2, {tables:{t1:{
                    target: 't1_calc',
                    sourceJoin: 'inner join t0 using(pk0)',
                    sourceBro: 't1',
                    where: 't1_calc.t1 = t1.t1 and t1_calc.pk0=t0.pk0',
            }}},{
                dato1:{tabla:'t1'},
                dato2:{tabla:'t1', clase:'calculada'},
                j:{tabla:'t1'},
            })
            var sentenciaEsperada = '  UPDATE t1_calc\n    SET x = t1.dato1 * 2 + t1_calc.dato2,\n        pepe = f(t1.j)\n    FROM t1 inner join t0 using(pk0)\n    WHERE t1_calc.t1 = t1.t1 and t1_calc.pk0=t0.pk0';
            discrepances.showAndThrow(sqlGenerado, sentenciaEsperada);
            this.timeout(50000);
        });
        it("genera un update basado en 2 variables con definition structure", async function () {
            var sqlGenerado = VarCal.sentenciaUpdate({
                tabla: 't1',
                variables: [{
                    nombreVariable: 'x',
                    expresionValidada: 'dato1 * 2 + dato2'
                }, {
                    nombreVariable: 'pepe',
                    expresionValidada: 'f(j)'
                }]
            }, 2, {
                    tables: {
                        t1: {
                            target: 't1_calc',
                            sourceJoin: 'inner join t0 using(pk0)',
                            sourceBro: 't1',
                            where: 't1_calc.t1 = t1.t1 and t1_calc.pk0=t0.pk0',
                        }
                    }
                })
            var sentenciaEsperada = '  UPDATE t1_calc\n    SET x = dato1 * 2 + dato2,\n        pepe = f(j)\n    FROM t1 inner join t0 using(pk0)\n    WHERE t1_calc.t1 = t1.t1 and t1_calc.pk0=t0.pk0';
            discrepances.showAndThrow(sqlGenerado, sentenciaEsperada);
            this.timeout(50000);
        });
        it("genera un update basado en 2 variables cuyos insumos pertenecen a un alias, con definition structure", async function () {
            var sqlGenerado = VarCal.sentenciaUpdate({
                tabla: 'personas',
                variables: [{
                    nombreVariable: 'x', expresionValidada: 'ingreso * 2 + ingreso2', insumos: { variables: ['ingreso', 'ingreso2'] }
                }, {
                    nombreVariable: 'dif_edad_padre', expresionValidada: 'padre.edad - edad', insumos: { variables: ['padre.edad', 'edad'], aliases: ['padre'] }
                }]
            }, 14, {
                    aliases: {
                        padre: {
                            tabla: 'personas',
                            on: 'padre.id = personas.id AND padre.p0 = personas.p11',
                        }
                    },
                    tables: {
                        personas: {
                            target: 'personas_calc',
                            sourceJoin: 'inner join t0 using(pk0)',
                            sourceBro: 'personas',
                            where: 'personas_calc.id = personas.id and personas_calc.pk0=t0.pk0',
                            pkString:'operativo, id_caso'
                        }
                    }
                })
            var sentenciaEsperada =
                `              UPDATE personas_calc
                SET x = ingreso * 2 + ingreso2,
                    dif_edad_padre = padre.edad - edad
                FROM personas inner join t0 using(pk0)
                    LEFT JOIN (
                        SELECT operativo, id_caso, padre.edad
                          FROM personas padre
                    ) padre ON padre.id = personas.id AND padre.p0 = personas.p11
                WHERE personas_calc.id = personas.id and personas_calc.pk0=t0.pk0`;
            discrepances.showAndThrow(sqlGenerado, sentenciaEsperada);
            this.timeout(50000);
        });
        it("genera un update basado en variables de otras tablas", async function () {
            var sqlGenerado = VarCal.sentenciaUpdate({
                tabla: 't1',
                variables: [{
                    nombreVariable: 'x',
                    expresionValidada: 'dato1 * 2 + dato2',
                }],
                joins: [{
                    tabla: 't2',
                    clausulaJoin: 't2.id = t1.id'
                }, {
                    tabla: 't3',
                    clausulaJoin: 't2.id = t1.id and t2.id=t3.id'
                }]
            }, 1);
            var sentenciaEsperada =
                ` UPDATE t1
   SET x = dato1 * 2 + dato2
   FROM t2, t3
   WHERE t2.id = t1.id
     AND t2.id = t1.id and t2.id=t3.id`;
            discrepances.showAndThrow(sqlGenerado, sentenciaEsperada);
        });
    });
    describe("sentenciaUpdate agregada", function () {
        it("genera un update basado en 2 variables con definition structure con funciones de agregación", async function () {
            var sqlGenerado = VarCal.sentenciaUpdate({
                tabla: 'hogares',
                variables: [{
                    nombreVariable: 'cantidad_mujeres',
                    expresionValidada: 'sexo=2',
                    funcion_agregacion: 'contar',
                    tabla_agregada: 'personas'
                }, {
                    nombreVariable: 'cant_revisitas',
                    expresionValidada: 'true',
                    funcion_agregacion: 'contar',
                    tabla_agregada: 'visitas'
                }, {
                    nombreVariable: 'ingresos_hogar',
                    expresionValidada: 'ingreso_personal',
                    funcion_agregacion: 'sumar',
                    tabla_agregada: 'personas'
                }, {
                    nombreVariable: 'tres',
                    expresionValidada: 'uno+dos'
                }],
            }, 14, {
                    tables: {
                        hogares: {
                            target: 'hogares_calc',
                            sourceJoin: 'inner join viviendas using(v)',
                            sourceBro: 'hogares',
                            where: 'hogares_calc.h = hogares.h and hogares_calc.v=hogares.v',
                        },
                        personas: {
                            aliasAgg: 'personas_agg',
                            sourceAgg: 'personas_calc inner join personas ON personas_calc.v=personas.v and personas_calc.h=personas.h and personas_calc.p=personas.p',
                            whereAgg:{ 
                                hogares: 'personas_calc.h = hogares.h and personas_calc.v = hogares.v'
                            }    
                        },
                        visitas: {
                            aliasAgg: 'visitas_agg',
                            sourceAgg: 'visitas',
                            whereAgg:{
                                hogares: 'visitas.h = hogares.h and visitas.v = hogares.v'
                            }    
                        }
                    }
                })
            var sentenciaEsperada =
                `              UPDATE hogares_calc
                SET cantidad_mujeres = personas_agg.cantidad_mujeres,
                    cant_revisitas = visitas_agg.cant_revisitas,
                    ingresos_hogar = personas_agg.ingresos_hogar,
                    tres = uno+dos
                FROM hogares inner join viviendas using(v), 
                  LATERAL (
                    SELECT
                        count(nullif(sexo=2,false)) as cantidad_mujeres,
                        sum(ingreso_personal) as ingresos_hogar
                      FROM personas_calc inner join personas ON personas_calc.v=personas.v and personas_calc.h=personas.h and personas_calc.p=personas.p
                      WHERE personas_calc.h = hogares.h and personas_calc.v = hogares.v
                  ) personas_agg, 
                  LATERAL (
                    SELECT
                        count(nullif(true,false)) as cant_revisitas
                      FROM visitas
                      WHERE visitas.h = hogares.h and visitas.v = hogares.v
                  ) visitas_agg
                WHERE hogares_calc.h = hogares.h and hogares_calc.v=hogares.v`;
            discrepances.showAndThrow(sqlGenerado, sentenciaEsperada);
            this.timeout(50000);
        });
    });
    describe("prueba get Insumos", function () {
        it("genera funciones y variales", function () {
            let expectedInsumos: VarCal.Insumos = { variables: ['a', 't.c'], aliases: ['t'], funciones: ['f', 'max'] }
            discrepances.showAndThrow(VarCal.getInsumos('a + t.c AND f(max(a, t.c))'), expectedInsumos);
        });
    });
    describe("funcionGeneradora", function () {
        it("genera función simple", async function () {
            var funcionGenerada = VarCal.funcionGeneradora([{
                tabla: 'datos',
                variables: [{
                    nombreVariable: 'doble_y_suma', expresionValidada: 'dato1 * 2 + dato2'
                }],
            }, {
                tabla: 'datos',
                variables: [{
                    nombreVariable: 'cal1', expresionValidada: 'doble_y_suma + dato1'
                }, {
                    nombreVariable: 'cal2', expresionValidada: 'doble_y_suma + dato2'
                }],
            }],
                {
                    nombreFuncionGeneradora: 'gen_fun',
                    esquema: 'test_varcal'
                }, {
                    tables: {
                        datos: {
                            target: 't1_calc',
                            sourceJoin: 'inner join t0 using(pk0)',
                            sourceBro: 't1',
                            where: 't1_calc.t1 = t1.t1 and t1_calc.pk0=t0.pk0',
                        }
                    }
                });
            var funcionEsperada = await fs.readFile('./test/fixtures/first-generated-fun.sql', { encoding: 'UTF8' });
            discrepances.showAndThrow(funcionGenerada, funcionEsperada);
        });
    });
    describe("funcionGeneradora", function () {
        it("genera función compleja", async function () {
            var funcionGenerada = VarCal.funcionGeneradora([{
                tabla: 'datos',
                variables: [{
                    nombreVariable: 'doble_y_suma', expresionValidada: 'dato1 * 2 + dato2'
                }],
            }, {
                tabla: 'datos2',
                variables: [{
                    nombreVariable: 'cal1', expresionValidada: 'doble_y_suma + dato1'
                }, {
                    nombreVariable: 'cal2', expresionValidada: 'doble_y_suma + dato2'
                }],
            }],
                {
                    nombreFuncionGeneradora: 'gen_fun',
                    esquema: 'test_varcal'
                }, {
                    tables: {
                        datos: {
                            target: 't1_calc',
                            sourceJoin: 'inner join t0 using(pk0)',
                            sourceBro: 't1',
                            where: 't1_calc.t1 = datos.t1 and t1_calc.pk0=t0.pk0',
                        },
                        datos2: {
                            target: 't2_calc',
                            sourceJoin: 'inner join t0 using(pk0) join t1_calc using(pk0)',
                            sourceBro: 't2',
                            where: 't2_calc.t2 = datos2.t2 and t2_calc.pk0=t0.pk0 and t2_calc.pk0=t1_calc.pk0',
                        }
                    }
                });
            var funcionEsperada = await fs.readFile('./test/fixtures/second-generated-fun.sql', { encoding: 'UTF8' });
            discrepances.showAndThrow(funcionGenerada, funcionEsperada);
        });
    });
    describe("calcularNiveles", function () {
        it("separa en listas por nivel", async function () {
            var resultadoNiveles = VarCal.separarEnGruposPorNivelYOrigen([
                { tabla: 'datos', nombreVariable: 'doble_y_suma', expresionValidada: 'dato1 * 2 + dato2', insumos: { variables: ['dato1', 'dato2'], aliases: [], funciones: [] } },
                { tabla: 'datos', nombreVariable: 'cal1', expresionValidada: 'doble_y_suma + dato1', insumos: { variables: ['doble_y_suma', 'dato1'], aliases: [], funciones: [] } },
                { tabla: 'datos', nombreVariable: 'cal2', expresionValidada: 'doble_y_suma + dato2', insumos: { variables: ['doble_y_suma', 'dato2'], aliases: [], funciones: [] } }
            ], ['dato1', 'dato2']);
            var listaEsperada: VarCal.BloqueVariablesGenerables[] = [{
                tabla: 'datos',
                variables: [{
                    nombreVariable: 'doble_y_suma', expresionValidada: 'dato1 * 2 + dato2', insumos: { variables: ['dato1', 'dato2'], aliases: [], funciones: [] }
                }],
            }, {
                tabla: 'datos',
                variables: [{
                    nombreVariable: 'cal1', expresionValidada: 'doble_y_suma + dato1', insumos: { variables: ['doble_y_suma', 'dato1'], aliases: [], funciones: [] }
                }, {
                    nombreVariable: 'cal2', expresionValidada: 'doble_y_suma + dato2', insumos: { variables: ['doble_y_suma', 'dato2'], aliases: [], funciones: [] }
                }],
            }];
            discrepances.showAndThrow(resultadoNiveles, listaEsperada);
        });
        it("separa en listas por nivel con orden inverso", async function () {
            var resultadoNiveles = VarCal.separarEnGruposPorNivelYOrigen([
                { tabla: 'datos', nombreVariable: 'cal0', expresionValidada: 'doble_y_suma + cal1', insumos: { variables: ['doble_y_suma', 'cal1'], aliases: [], funciones: [] } },
                { tabla: 'datos', nombreVariable: 'cal1', expresionValidada: 'doble_y_suma + dato1', insumos: { variables: ['doble_y_suma', 'dato1'], aliases: [], funciones: [] } },
                { tabla: 'datos', nombreVariable: 'cal2', expresionValidada: 'doble_y_suma + dato2', insumos: { variables: ['doble_y_suma', 'dato2'], aliases: [], funciones: [] } },
                { tabla: 'datos', nombreVariable: 'doble_y_suma', expresionValidada: 'dato1 * 2 + dato2', insumos: { variables: ['dato1', 'dato2'], aliases: [], funciones: [] } }
            ], ['dato1', 'dato2']);
            var listaEsperada: VarCal.BloqueVariablesGenerables[] = [{
                tabla: 'datos',
                variables: [{
                    nombreVariable: 'doble_y_suma', expresionValidada: 'dato1 * 2 + dato2', insumos: { variables: ['dato1', 'dato2'], aliases: [], funciones: [] }
                }],
            }, {
                tabla: 'datos',
                variables: [{
                    nombreVariable: 'cal1', expresionValidada: 'doble_y_suma + dato1', insumos: { variables: ['doble_y_suma', 'dato1'], aliases: [], funciones: [] }
                }, {
                    nombreVariable: 'cal2', expresionValidada: 'doble_y_suma + dato2', insumos: { variables: ['doble_y_suma', 'dato2'], aliases: [], funciones: [] }
                }],
            }, {
                tabla: 'datos',
                variables: [{
                    nombreVariable: 'cal0', expresionValidada: 'doble_y_suma + cal1', insumos: { variables: ['doble_y_suma', 'cal1'], aliases: [], funciones: [] }
                }],
            }];
            discrepances.showAndThrow(resultadoNiveles, listaEsperada);
        });
        it("separa en listas por nivel usando alias", async function () {
            var resultadoNiveles = VarCal.separarEnGruposPorNivelYOrigen([
                { tabla: 'datos', nombreVariable: 'doble_y_suma', expresionValidada: 'dato1 * 2 + dato2', insumos: { variables: ['dato1', 'dato2'], aliases: [], funciones: [] } },
                { tabla: 'personas', nombreVariable: 'dif_edad_padre', expresionValidada: 'padre.p3 - p3', insumos: { variables: ['padre.p3', 'p3'], aliases: ['padre'], funciones: [] } }
            ], ['p3', 'dato1', 'dato2'], {
                    aliases: {
                        padre: {
                            tabla: 'personas',
                            on: 'padre.id_caso = personas.id_caso AND padre.p0 = personas.p11 AND padre.operativo = personas.operativo',
                            where:''
                        }
                    },
                    tables: {}
                });
            var listaEsperada: VarCal.BloqueVariablesGenerables[] = [{
                tabla: 'datos',
                variables: [{
                    nombreVariable: 'doble_y_suma', expresionValidada: 'dato1 * 2 + dato2', insumos: { variables: ['dato1', 'dato2'], aliases: [], funciones: [] }
                }],
            }, {
                tabla: 'personas',
                variables: [{
                    nombreVariable: 'dif_edad_padre', expresionValidada: 'padre.p3 - p3', insumos: { variables: ['padre.p3', 'p3'], aliases: ['padre'], funciones: [] }
                }],
            }];
            discrepances.showAndThrow(resultadoNiveles, listaEsperada);
        });
        it("separa en listas por nivel que usa prefijos de tablas (no de aliases), por ej unidades de análisis con wrappers", async function () {
            var resultadoNiveles = VarCal.separarEnGruposPorNivelYOrigen([
                { tabla: 'datos', nombreVariable: 'promedio_edad', expresionValidada: 'div0err(null2zero(suma_edad), null2zero(cant_f2), grupo_personas.operativo, grupo_personas.id_caso)', insumos: { variables: ['suma_edad', 'cant_f2', 'grupo_personas.operativo', 'grupo_personas.id_caso'], aliases: ['grupo_personas'], funciones: ['div0err', 'null2zero'] } },
            ], ['suma_edad', 'cant_f2', 'operativo', 'id_caso'], {
                    tables: {
                        grupo_personas: {}
                    }
                });
            var listaEsperada: VarCal.BloqueVariablesGenerables[] = [{
                tabla: 'datos',
                variables: [{
                    nombreVariable: 'promedio_edad', expresionValidada: 'div0err(null2zero(suma_edad), null2zero(cant_f2), grupo_personas.operativo, grupo_personas.id_caso)', insumos: { variables: ['suma_edad', 'cant_f2', 'grupo_personas.operativo', 'grupo_personas.id_caso'], aliases: ['grupo_personas'], funciones: ['div0err', 'null2zero'] }
                }],
            }];
            discrepances.showAndThrow(resultadoNiveles, listaEsperada);
        });
        it("protesta si no se puede por abrazo mortal", async function () {
            try {
                VarCal.separarEnGruposPorNivelYOrigen([
                    { tabla: 'datos', nombreVariable: 'a', expresionValidada: 'b', insumos: { variables: ['b'], aliases: [], funciones: [] } },
                    { tabla: 'datos', nombreVariable: 'b', expresionValidada: 'a', insumos: { variables: ['a'], aliases: [], funciones: [] } },
                ], ['dato1', 'dato2']);
                throw new Error('Tenía que dar error por abrazo mortal');
            } catch (err) {
                discrepances.showAndThrow(err.message, "Error, no se pudo determinar el orden de la variable 'a' y otras")
            }
            this.timeout(50000);
        });
        it("protesta si no se puede porque no encuentra el prefijo en la definición estructural", async function () {
            try {
                VarCal.separarEnGruposPorNivelYOrigen([
                    { tabla: 'datos', nombreVariable: 'a', expresionValidada: 'prefix_alias.dato2 + 4', insumos: { variables: ['prefix_alias.dato2'], aliases: ['prefix_alias'], funciones: [] } },
                ], ['dato1', 'dato2']);
                throw new Error('Tenía que dar error por abrazo mortal');
            } catch (err) {
                discrepances.showAndThrow(err.message, "Error, no se pudo determinar el orden de la variable 'a' y otras")
            }
            this.timeout(50000);
        });
        it("separa en listas por nivel y obtiene el join", async function () {
            var resultadoNiveles = VarCal.separarEnGruposPorNivelYOrigen([
                { tabla: 'datos', nombreVariable: 'doble_y_suma', expresionValidada: 'dato1 * 2 + dato2', insumos: { variables: ['dato1', 'dato2'], aliases: [], funciones: [] } },
                { tabla: 'datos', nombreVariable: 'cal1', joins: [{ tabla: 't1', clausulaJoin: 't1.x=datos.x' }, { tabla: 't2', clausulaJoin: 't2.y=t1.y' }], expresionValidada: 'doble_y_suma + dato1', insumos: { variables: ['doble_y_suma', 'dato1'], aliases: [], funciones: [] } },
                { tabla: 'datos', nombreVariable: 'cal2', joins: [{ tabla: 't1', clausulaJoin: 't1.x=datos.x' }], expresionValidada: 'doble_y_suma + dato2', insumos: { variables: ['doble_y_suma', 'dato2'], aliases: [], funciones: [] } },
                { tabla: 'datos', nombreVariable: 'cal3', joins: [{ tabla: 't1', clausulaJoin: 't1.x=datos.x' }, { tabla: 't2', clausulaJoin: 't2.y=t1.y' }], expresionValidada: 'doble_y_suma + dato2', insumos: { variables: ['doble_y_suma', 'dato2'], aliases: [], funciones: [] } },
            ], ['dato1', 'dato2']);
            var listaEsperada: VarCal.BloqueVariablesGenerables[] = [{
                tabla: 'datos',
                variables: [{
                    nombreVariable: 'doble_y_suma', expresionValidada: 'dato1 * 2 + dato2', insumos: { variables: ['dato1', 'dato2'], aliases: [], funciones: [] }
                }],
            }, {
                tabla: 'datos',
                variables: [{
                    nombreVariable: 'cal1', expresionValidada: 'doble_y_suma + dato1', insumos: { variables: ['doble_y_suma', 'dato1'], aliases: [], funciones: [] }
                }, {
                    nombreVariable: 'cal3', expresionValidada: 'doble_y_suma + dato2', insumos: { variables: ['doble_y_suma', 'dato2'], aliases: [], funciones: [] }
                }],
                joins: [{ tabla: 't1', clausulaJoin: 't1.x=datos.x' }, { tabla: 't2', clausulaJoin: 't2.y=t1.y' }]
            }, {
                tabla: 'datos',
                variables: [{
                    nombreVariable: 'cal2', expresionValidada: 'doble_y_suma + dato2', insumos: { variables: ['doble_y_suma', 'dato2'], aliases: [], funciones: [] }
                }],
                joins: [{ tabla: 't1', clausulaJoin: 't1.x=datos.x' }]
            }];
            discrepances.showAndThrow(resultadoNiveles, listaEsperada);
            this.timeout(50000);
        });
        it("separa con dependencias complejas", async function () {
            var resultadoNiveles = VarCal.separarEnGruposPorNivelYOrigen([
                { tabla: 'datos', nombreVariable: 'abbaab', expresionValidada: 'abb+aab', insumos: { variables: ['aab', 'abb'], aliases: [], funciones: [] } },
                { tabla: 'datos', nombreVariable: 'a', expresionValidada: 'o', insumos: { variables: [], aliases: [], funciones: [] } },
                { tabla: 'equis', nombreVariable: 'ab', expresionValidada: 'a+b', insumos: { variables: ['a', 'b'], aliases: [], funciones: [] } },
                // {tabla:'datos', nombreVariable:'aa'    , expresionValidada:'a+a'    , insumos:{variables:['a'],aliases:[], funciones:[]}}, 
                { tabla: 'datos', nombreVariable: 'aab', expresionValidada: 'a+ab', insumos: { variables: ['a', 'ab'], aliases: [], funciones: [] } },
                { tabla: 'datos', nombreVariable: 'b', expresionValidada: 'o', insumos: { variables: ['o'], aliases: [], funciones: [] } },
                { tabla: 'datos', nombreVariable: 'abb', expresionValidada: 'ab+b', insumos: { variables: ['ab', 'b'], aliases: [], funciones: [] } },
            ], ['o']);
            var listaEsperada: VarCal.BloqueVariablesGenerables[] = [{
                tabla: 'datos',
                variables: [
                    { nombreVariable: 'a', expresionValidada: 'o', insumos: { variables: [], aliases: [], funciones: [] } },
                    { nombreVariable: 'b', expresionValidada: 'o', insumos: { variables: ['o'], aliases: [], funciones: [] } },
                ],
            }, {
                tabla: 'equis',
                variables: [
                    { nombreVariable: 'ab', expresionValidada: 'a+b', insumos: { variables: ['a', 'b'], aliases: [], funciones: [] } },
                ],
                //},{
                //    tabla:'datos',
                //    variables:[
                //        {nombreVariable:'aa'    , expresionValidada:'a+a'    , insumos:{variables:['a'],aliases:[], funciones:[]}}, 
                //    ],
            }, {
                tabla: 'datos',
                variables: [
                    { nombreVariable: 'aab', expresionValidada: 'a+ab', insumos: { variables: ['a', 'ab'], aliases: [], funciones: [] } },
                    { nombreVariable: 'abb', expresionValidada: 'ab+b', insumos: { variables: ['ab', 'b'], aliases: [], funciones: [] } },
                ],
            }, {
                tabla: 'datos',
                variables: [
                    { nombreVariable: 'abbaab', expresionValidada: 'abb+aab', insumos: { variables: ['aab', 'abb'], aliases: [], funciones: [] } },
                ],
            }];
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