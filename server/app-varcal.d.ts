import { Request } from "backend-plus";
import * as backendPlus from "backend-plus";
import * as pgPromise from "pg-promise-strict";
import * as express from "express";
import { AppOperativos, TableContext } from "operativos";
export declare type Constructor<T> = new (...args: any[]) => T;
export declare function emergeAppVarCal<T extends Constructor<InstanceType<typeof AppOperativos>>>(Base: T): {
    new (...args: any[]): {
        getProcedures(): Promise<backendPlus.ProcedureDef[]>;
        clientIncludes(req: Request, hideBEPlusInclusions: boolean): backendPlus.ClientModuleDefinition[];
        getMenu(): backendPlus.MenuDefinition;
        prepareGetTables(): void;
        getTableDefinition: import("../../node_modules/operativos/server/types-operativos").TableDefinitionsGetters;
        appendToTableDefinition(tableName: string, appenderFunction: (tableDef: backendPlus.TableDefinition, context?: TableContext) => void): void;
        getTables: () => backendPlus.TableItemDef[];
        app: express.Express;
        db: typeof pgPromise;
        start: () => Promise<void>;
        getContext: (req: Request) => backendPlus.Context;
        addSchrödingerServices: (mainApp: express.Express, baseUrl: string) => void;
        addLoggedServices: () => void;
        inDbClient: <T_1>(req: Request, doThisWithDbClient: (client: pgPromise.Client) => Promise<T_1>) => Promise<T_1>;
        inTransaction: <T_1>(req: Request, doThisWithDbTransaction: (client: pgPromise.Client) => Promise<T_1>) => Promise<T_1>;
        procedureDefCompleter: (procedureDef: backendPlus.ProcedureDef) => backendPlus.ProcedureDef;
        tableDefAdapt: (tableDef: backendPlus.TableDefinition, context: backendPlus.Context) => backendPlus.TableDefinition;
        pushApp: (dirname: string) => void;
        dumpDbSchemaPartial: (partialTableStructures: {
            [k: string]: backendPlus.TableDefinition;
        }, opts?: {
            complete?: boolean;
            skipEnance?: boolean;
        }) => Promise<any>;
    };
} & T;
