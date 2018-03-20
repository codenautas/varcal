import * as MiniTools  from 'mini-tools';
import * as discrepances from 'discrepances';
import * as pg from 'pg-promise-strict';

import 'mocha';

pg.easy = true;

var config = {
    db:{
        motor: 'postgres',
        database: 'test_db',
        schema: 'varcal',
        user: 'test_user',
        password: 'test_pass',
    }
}

describe("única unidad de análisis",function(){
    var client:pg.Client;
    before(async function(){
        this.timeout(50000);
        config = await MiniTools.readConfig(
            [config,'test/local-config'],
            {whenNotExist:'ignore'}
        ) as typeof config;
        client = await pg.connect(config.db);
        await client.executeSqlScript('test/fixtures/initial_db.sql');
        console.log('system ready');
    });
    it("primer test", async function(){
        var dato = await client.query("select dato from datos where id=1").fetchUniqueValue()
        discrepances.showAndThrow(dato.value, 42);
        this.timeout(50000);
    });
    after(async function(){
        client.done();
    });
});

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});