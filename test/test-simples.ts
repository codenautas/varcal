import * as MiniTools  from 'mini-tools';
import * as discrepances from 'discrepances';
import * as pg from 'pg-promise-strict';
import * as fs from 'fs-extra';

import 'mocha';

import * as VarCal from '../src/var-cal';

(pg as {easy:boolean}).easy = true;

var config = {
    db:{
        motor: 'postgres',
        database: 'test_db',
        schema: 'varcal',
        user: 'test_user',
        password: 'test_pass',
    }
}

describe("varcal", function(){
    var client:pg.Client;
    before(async function(){
        this.timeout(50000);
        config = await MiniTools.readConfig(
            [config, 'test/local-config'],
            {whenNotExist:'ignore'}
        ) as typeof config;
        client = await pg.connect(config.db);
        await client.executeSqlScript('test/fixtures/initial_db.sql');
        console.log('system ready');
    });
    describe("sentenciaUpdate", function(){
        it("genera un update basado en 2 variables", async function(){
            var sqlGenerado = VarCal.sentenciaUpdate({
                tabla:'t1',
                variables:[{
                    nombreVariable:'x', 
                    expresionValidada:'dato1 * 2 + dato2'
                },{
                    nombreVariable:'pepe', 
                    expresionValidada:'f(j)'
                }]
            }, 2)
            var sentenciaEsperada = '  UPDATE t1\n    SET x = dato1 * 2 + dato2,\n        pepe = f(j)';
            discrepances.showAndThrow(sqlGenerado, sentenciaEsperada);
            this.timeout(50000);
        });
        it("genera un update basado en 2 variables con definition structure", async function(){
            var sqlGenerado = VarCal.sentenciaUpdate({
                tabla:'t1',
                variables:[{
                    nombreVariable:'x', 
                    expresionValidada:'dato1 * 2 + dato2'
                },{
                    nombreVariable:'pepe', 
                    expresionValidada:'f(j)'
                }]
            }, 2, {
                tables:{
                    t1:{
                        target: 't1_cal',
                        sourceJoin: 't1 inner join t0 using(pk0)',
                        where: 't1_cal.t1 = t1.t1 and t1_cal.pk0=t0.pk0',
                    }
                }
            })
            var sentenciaEsperada = '  UPDATE t1_cal\n    SET x = dato1 * 2 + dato2,\n        pepe = f(j)\n    FROM t1 inner join t0 using(pk0)\n    WHERE t1_cal.t1 = t1.t1 and t1_cal.pk0=t0.pk0';
            discrepances.showAndThrow(sqlGenerado, sentenciaEsperada);
            this.timeout(50000);
        });
        it("genera un update basado en variables de otras tablas", async function(){
            var sqlGenerado = VarCal.sentenciaUpdate({
                tabla:'t1',
                variables:[{
                    nombreVariable:'x', 
                    expresionValidada:'dato1 * 2 + dato2',
                }],
                joins:[{
                    tabla:'t2', 
                    clausulaJoin:'t2.id = t1.id'
                },{
                    tabla:'t3',
                    clausulaJoin:'t2.id = t1.id and t2.id=t3.id'
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
    describe("prueba get Insumos", function(){
        it("genera funciones y variales", function(){
            let expectedInsumos: VarCal.Insumos = {variables:['a', 't.c'], funciones:['f', 'max']}
            discrepances.showAndThrow(VarCal.getInsumos('a + t.c AND f(max(a, t.c))'), expectedInsumos);
        });
    });
    describe("funcionGeneradora", function(){
        it("genera función simple", async function(){
            var funcionGenerada = VarCal.funcionGeneradora([{
                tabla:'datos',
                variables:[{
                    nombreVariable:'doble_y_suma', expresionValidada:'dato1 * 2 + dato2'
                }],
            },{
                tabla:'datos',
                variables:[{
                    nombreVariable:'cal1', expresionValidada:'doble_y_suma + dato1'
                },{
                    nombreVariable:'cal2', expresionValidada:'doble_y_suma + dato2'
                }],
            }], 
            {
                nombreFuncionGeneradora:'gen_fun',
                esquema:'test_varcal'
            },{
                tables:{
                    datos:{
                        target: 't1_cal',
                        sourceJoin: 't1 inner join t0 using(pk0)',
                        where: 't1_cal.t1 = t1.t1 and t1_cal.pk0=t0.pk0',
                    }
                }
            });
            var funcionEsperada = await fs.readFile('./test/fixtures/first-generated-fun.sql', {encoding:'UTF8'});
            discrepances.showAndThrow(funcionGenerada, funcionEsperada);
        });
    });
    describe("funcionGeneradora", function(){
        it("genera función compleja", async function(){
            var funcionGenerada = VarCal.funcionGeneradora([{
                tabla:'datos',
                variables:[{
                    nombreVariable:'doble_y_suma', expresionValidada:'dato1 * 2 + dato2'
                }],
            },{
                tabla:'datos2',
                variables:[{
                    nombreVariable:'cal1', expresionValidada:'doble_y_suma + dato1'
                },{
                    nombreVariable:'cal2', expresionValidada:'doble_y_suma + dato2'
                }],
            }], 
            {
                nombreFuncionGeneradora:'gen_fun',
                esquema:'test_varcal'
            },{
                tables:{
                    datos:{
                        target: 't1_cal',
                        sourceJoin: 't1 inner join t0 using(pk0)',
                        where: 't1_cal.t1 = datos.t1 and t1_cal.pk0=t0.pk0',
                    },
                    datos2:{
                        target: 't2_cal',
                        sourceJoin: 't2 inner join t0 using(pk0) join t1_cal using(pk0)',
                        where: 't2_cal.t2 = datos2.t2 and t2_cal.pk0=t0.pk0 and t2_cal.pk0=t1_cal.pk0',
                    }
                }
            });
            var funcionEsperada = await fs.readFile('./test/fixtures/second-generated-fun.sql', {encoding:'UTF8'});
            discrepances.showAndThrow(funcionGenerada, funcionEsperada);
        });
    });
    describe("calcularNiveles", function(){
        it("separa en listas por nivel", async function(){
            var resultadoNiveles = VarCal.separarEnGruposPorNivelYOrigen([
                {tabla:'datos', nombreVariable:'doble_y_suma', expresionValidada:'dato1 * 2 + dato2', insumos:{variables:['dato1','dato2'],funciones:[]}},
                {tabla:'datos', nombreVariable:'cal1', expresionValidada:'doble_y_suma + dato1', insumos:{variables:['doble_y_suma','dato1'],funciones:[]}},
                {tabla:'datos', nombreVariable:'cal2', expresionValidada:'doble_y_suma + dato2', insumos:{variables:['doble_y_suma','dato2'],funciones:[]}}
            ],['dato1','dato2']);
            var listaEsperada: VarCal.BloqueVariablesGenerables[]= [{
                tabla:'datos',
                variables:[{
                    nombreVariable:'doble_y_suma', expresionValidada:'dato1 * 2 + dato2', insumos:{variables:['dato1','dato2'],funciones:[]}
                }],
            },{
                tabla:'datos',
                variables:[{
                    nombreVariable:'cal1', expresionValidada:'doble_y_suma + dato1',insumos:{variables:['doble_y_suma','dato1'],funciones:[]}
                },{
                    nombreVariable:'cal2', expresionValidada:'doble_y_suma + dato2', insumos:{variables:['doble_y_suma','dato2'],funciones:[]}
                }],
            }];
            discrepances.showAndThrow(resultadoNiveles , listaEsperada);
        });
        it("protesta si no se puede", async function(){
            try{
                VarCal.separarEnGruposPorNivelYOrigen([
                    {tabla:'datos', nombreVariable:'a', expresionValidada:'b', insumos:{variables:['b'],funciones:[]}},
                    {tabla:'datos', nombreVariable:'b', expresionValidada:'a', insumos:{variables:['a'],funciones:[]}},
                ],['dato1','dato2']);
                throw new Error('Tenía que dar error por abrazo mortal');
            }catch(err){
                discrepances.showAndThrow(err.message, "Error, no se pudo determinar el orden de la variable 'a' y otras")
            }
            this.timeout(50000);
        });
        it("separa en listas por nivel y obtiene el join", async function(){
            var resultadoNiveles = VarCal.separarEnGruposPorNivelYOrigen([
                {tabla:'datos', nombreVariable:'doble_y_suma', expresionValidada:'dato1 * 2 + dato2', insumos:{variables:['dato1','dato2'],funciones:[]}},
                {tabla:'datos', nombreVariable:'cal1', joins:[{tabla:'t1',clausulaJoin:'t1.x=datos.x'},{tabla:'t2',clausulaJoin:'t2.y=t1.y'}], expresionValidada:'doble_y_suma + dato1', insumos:{variables:['doble_y_suma','dato1'],funciones:[]}},
                {tabla:'datos', nombreVariable:'cal2', joins:[{tabla:'t1',clausulaJoin:'t1.x=datos.x'}], expresionValidada:'doble_y_suma + dato2', insumos:{variables:['doble_y_suma','dato2'],funciones:[]}},
                {tabla:'datos', nombreVariable:'cal3', joins:[{tabla:'t1',clausulaJoin:'t1.x=datos.x'},{tabla:'t2',clausulaJoin:'t2.y=t1.y'}], expresionValidada:'doble_y_suma + dato2', insumos:{variables:['doble_y_suma','dato2'],funciones:[]}},
            ],['dato1','dato2']);
            var listaEsperada: VarCal.BloqueVariablesGenerables[]= [{
                tabla:'datos',
                variables:[{
                    nombreVariable:'doble_y_suma', expresionValidada:'dato1 * 2 + dato2', insumos:{variables:['dato1','dato2'],funciones:[]}
                }],
            },{
                tabla:'datos',
                variables:[{
                    nombreVariable:'cal1', expresionValidada:'doble_y_suma + dato1',insumos:{variables:['doble_y_suma','dato1'],funciones:[]}
                },{
                    nombreVariable:'cal3', expresionValidada:'doble_y_suma + dato2', insumos:{variables:['doble_y_suma','dato2'],funciones:[]}
                }],
                joins:[{tabla:'t1',clausulaJoin:'t1.x=datos.x'},{tabla:'t2',clausulaJoin:'t2.y=t1.y'}]
            },{
                tabla:'datos',
                variables:[{
                    nombreVariable:'cal2', expresionValidada:'doble_y_suma + dato2',insumos:{variables:['doble_y_suma','dato2'],funciones:[]}
                }],
                joins:[{tabla:'t1',clausulaJoin:'t1.x=datos.x'}]
            }];
            discrepances.showAndThrow(resultadoNiveles , listaEsperada);
            this.timeout(50000);
        });
        it("separa con dependencias complejas", async function(){
            var resultadoNiveles = VarCal.separarEnGruposPorNivelYOrigen([
                {tabla:'datos', nombreVariable:'abbaab', expresionValidada:'abb+aab', insumos:{variables:['aab','abb'],funciones:[]}}, 
                {tabla:'datos', nombreVariable:'a'     , expresionValidada:'o'      , insumos:{variables:[],funciones:[]}},
                {tabla:'equis', nombreVariable:'ab'    , expresionValidada:'a+b'    , insumos:{variables:['a','b'],funciones:[]}}, 
                // {tabla:'datos', nombreVariable:'aa'    , expresionValidada:'a+a'    , insumos:{variables:['a'],funciones:[]}}, 
                {tabla:'datos', nombreVariable:'aab'   , expresionValidada:'a+ab'   , insumos:{variables:['a','ab'],funciones:[]}}, 
                {tabla:'datos', nombreVariable:'b'     , expresionValidada:'o'      , insumos:{variables:['o'],funciones:[]}}, 
                {tabla:'datos', nombreVariable:'abb'   , expresionValidada:'ab+b'   , insumos:{variables:['ab','b'],funciones:[]}}, 
            ], ['o']);
            var listaEsperada: VarCal.BloqueVariablesGenerables[]= [{
                tabla:'datos',
                variables:[
                    {nombreVariable:'a'     , expresionValidada:'o'      , insumos:{variables:[],funciones:[]}},
                    {nombreVariable:'b'     , expresionValidada:'o'      , insumos:{variables:['o'],funciones:[]}}, 
                ],
            },{
                tabla:'equis',
                variables:[
                    {nombreVariable:'ab'    , expresionValidada:'a+b'    , insumos:{variables:['a','b'],funciones:[]}}, 
                ],
            //},{
            //    tabla:'datos',
            //    variables:[
            //        {nombreVariable:'aa'    , expresionValidada:'a+a'    , insumos:{variables:['a'],funciones:[]}}, 
            //    ],
            },{
                tabla:'datos',
                variables:[
                    {nombreVariable:'aab'   , expresionValidada:'a+ab'   , insumos:{variables:['a','ab'],funciones:[]}}, 
                    {nombreVariable:'abb'   , expresionValidada:'ab+b'   , insumos:{variables:['ab','b'],funciones:[]}}, 
                ],
            },{
                tabla:'datos',
                variables:[
                    {nombreVariable:'abbaab', expresionValidada:'abb+aab', insumos:{variables:['aab','abb'],funciones:[]}}, 
                ],
            }];
            discrepances.showAndThrow(resultadoNiveles , listaEsperada);
            this.timeout(50000);
        });
    });    
    after(async function(){
        client.done();
    });
});

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});