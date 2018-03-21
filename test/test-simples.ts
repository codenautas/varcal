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
    describe("funcionGeneradora", function(){
        it("genera función simple", async function(){
            var funcionGenerada = VarCal.funcionGeneradora([
                {tabla:'datos', nombreVariable:'doble_y_suma', expresionValidada:'dato1 * 2 + dato2'}
            ], {
                esquema:'test_varcal',
                nombreFuncionGeneradora:'gen_fun'
            });
            var funcionEsperada = await fs.readFile('./test/fixtures/first-generated-fun.sql', {encoding:'UTF8'});
            discrepances.showAndThrow(funcionGenerada, funcionEsperada);
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