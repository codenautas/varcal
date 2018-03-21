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
    describe("funcionGeneradora", function () {
        it("genera función simple", async function () {
            var funcionGenerada = VarCal.funcionGeneradora([
                { nombreVariable: 'doble_y_suma', expresionValidada: 'dato1 * 2 + dato2' }
            ], {
                nombreFuncionGeneradora: 'gen_fun'
            });
            var funcionEsperada = await fs.readFile('./test/fixtures/first-generated-fun.sql', { encoding: 'UTF8' });
            discrepances.showAndThrow(funcionGenerada, funcionEsperada);
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