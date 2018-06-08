import * as pgPromise from "pg-promise-strict";
import * as express from "express";
import * as operativos from "operativos";
import { AppOperativos } from "operativos";
export * from './types-varcal';
export declare type Constructor<T> = new (...args: any[]) => T;
export declare function emergeAppVarCal<T extends Constructor<InstanceType<typeof AppOperativos>>>(Base: T): {
    new (...args: any[]): {
        getProcedures(): Promise<operativos.ProcedureDef[]>;
        clientIncludes(req: operativos.Request, hideBEPlusInclusions: boolean): operativos.ClientModuleDefinition[];
        getMenu(): operativos.MenuDefinition;
        prepareGetTables(): void;
        getTableDefinition: operativos.TableDefinitionsGetters;
        appendToTableDefinition(tableName: string, appenderFunction: (tableDef: operativos.TableDefinition, context?: operativos.TableContext) => void): void;
        getTables: () => operativos.TableItemDef[];
        app: express.Express;
        tableStructures: operativos.TableDefinitions;
        db: typeof pgPromise;
        config: any;
        start: () => Promise<void>;
        getContext: (req: operativos.Request) => operativos.Context;
        addSchrödingerServices: (mainApp: express.Express, baseUrl: string) => void;
        addLoggedServices: () => void;
        inDbClient: <T_1>(req: operativos.Request, doThisWithDbClient: (client: pgPromise.Client) => Promise<T_1>) => Promise<T_1>;
        inTransaction: <T_1>(req: operativos.Request, doThisWithDbTransaction: (client: pgPromise.Client) => Promise<T_1>) => Promise<T_1>;
        procedureDefCompleter: (procedureDef: operativos.ProcedureDef) => operativos.ProcedureDef;
        tableDefAdapt: (tableDef: operativos.TableDefinition, context: operativos.Context) => operativos.TableDefinition;
        pushApp: (dirname: string) => void;
        dumpDbSchemaPartial: (partialTableStructures: operativos.TableDefinitions, opts?: {
            complete?: boolean;
            skipEnance?: boolean;
        }) => Promise<any>;
        getContextForDump: () => operativos.ContextForDump;
    };
} & T;
