"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MiniTools = require("mini-tools");
const pg = require("pg-promise-strict");
require("mocha");
pg.easy = true;
describe("única unidad de análisis", function () {
    var config;
    var client;
    before(async function () {
        this.timeout(50000);
        config = await MiniTools.readConfig(['test/def-config', 'test/local-config'], { readConfig: { whenNotExist: 'ignore' }, testing: true });
        client = await pg.connect(config.db);
        await client.executeSqlScript('test/fixtures/initial_db.sql');
        console.log('system ready');
    });
    it("open and close dialogs", async function () {
        this.timeout(50000);
    });
    after(async function () {
    });
});
process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});
//# sourceMappingURL=test-simples.js.map