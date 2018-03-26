"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MiniTools = require("mini-tools");
const discrepances = require("discrepances");
const pg = require("pg-promise-strict");
const fs = require("fs-extra");
require("mocha");
const VarCal = require("../src/var-cal");
pg.easy = true;
var config = {
    db: {
        motor: 'postgres',
        database: 'test_db',
        schema: 'varcal',
        user: 'test_user',
        password: 'test_pass',
    }
};
describe("varcal", function () {
    var client;
    before(async function () {
        this.timeout(50000);
        config = await MiniTools.readConfig([config, 'test/local-config'], { whenNotExist: 'ignore' });
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
            }, 2);
            var sentenciaEsperada = '  UPDATE t1\n    SET x = dato1 * 2 + dato2,\n        pepe = f(j)';
            discrepances.showAndThrow(sqlGenerado, sentenciaEsperada);
            this.timeout(50000);
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
                }], {
                nombreFuncionGeneradora: 'gen_fun',
                esquema: 'test_varcal'
            });
            var funcionEsperada = await fs.readFile('./test/fixtures/first-generated-fun.sql', { encoding: 'UTF8' });
            discrepances.showAndThrow(funcionGenerada, funcionEsperada);
            this.timeout(50000);
        });
    });
    describe("calcularNiveles", function () {
        it("separa en listas por nivel", async function () {
            var resultadoNiveles = VarCal.calcularNiveles({
                tabla: 'datos',
                variables: [{
                        nombreVariable: 'doble_y_suma', expresionValidada: 'dato1 * 2 + dato2'
                    },
                    { nombreVariable: 'cal1', expresionValidada: 'doble_y_suma + dato1' },
                    { nombreVariable: 'cal2', expresionValidada: 'doble_y_suma + dato2'
                    }],
            });
            var listaEsperada = [{
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
//# sourceMappingURL=test-simples.js.map