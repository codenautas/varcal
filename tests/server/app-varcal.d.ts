import { MenuDefinition } from "operativos";
import { AppBackend, AppOperativosType, Constructor, TablaDatos, TableDefinition, TableDefinitions } from "./types-varcal";
export * from './types-varcal';
export * from './var-cal';
export declare function emergeAppVarCal<T extends Constructor<AppOperativosType>>(Base: T): {
    new (...args: any[]): {
        configStaticConfig(): void;
        generateAndLoadTableDefs(): TableDefinitions;
        generateBaseTableDef(tablaDatos: TablaDatos): TableDefinition;
        prepareGetTables(): void;
        getMenu(): MenuDefinition;
        allProcedures: import("backend-plus").ProcedureDef[];
        allClientFileNames: import("backend-plus").ClientModuleDefinition[];
        tablasDatos: any[];
        cargarGenerados(client: import("pg-promise-strict").Client): Promise<string>;
        postConfig: (() => Promise<void>) & ((...params: any[]) => any);
        getTableDefFunction(tableDef: TableDefinition): import("backend-plus").TableDefinitionFunction;
        loadTableDef(tableDef: TableDefinition): import("backend-plus").TableDefinitionFunction;
        generateAndLoadTableDef(tablaDatos: any): import("backend-plus").TableDefinitionFunction;
        getProcedures: (() => Promise<import("backend-plus").ProcedureDef[]>) & (() => Promise<import("backend-plus").ProcedureDef[]>);
        clientIncludes: ((req: import("backend-plus").Request, hideBEPlusInclusions: boolean) => import("backend-plus").ClientModuleDefinition[]) & ((req: import("backend-plus").Request, hideBEPlusInclusions?: boolean) => import("backend-plus").ClientModuleDefinition[]);
        procedures: import("backend-plus").ProcedureDef[];
        procedure: {
            [key: string]: import("backend-plus").ProcedureDef;
        } & {
            [key: string]: import("backend-plus").ProcedureDef;
        };
        app: import("backend-plus").ExpressPlus;
        getTableDefinition: import("backend-plus").TableDefinitionsGetters;
        tableStructures: TableDefinitions;
        db: typeof import("pg-promise-strict");
        config: any;
        rootPath: string;
        start: ((opts?: import("backend-plus").StartOptions) => Promise<void>) & ((opts?: import("backend-plus").StartOptions) => Promise<void>);
        getTables: (() => import("backend-plus").TableItemDef[]) & (() => import("backend-plus").TableItemDef[]);
        appendToTableDefinition: ((tableName: string, appenderFunction: (tableDef: TableDefinition, context?: import("backend-plus").TableContext) => void) => void) & ((tableName: string, appenderFunction: (tableDef: TableDefinition, context?: import("backend-plus").TableContext) => void) => void);
        getContext: ((req: import("backend-plus").Request) => import("backend-plus").Context) & ((req: import("backend-plus").Request) => import("backend-plus").Context);
        addSchrödingerServices: ((mainApp: import("backend-plus").ExpressPlus, baseUrl: string) => void) & ((mainApp: import("backend-plus").ExpressPlus, baseUrl: string) => void);
        addUnloggedServices: ((mainApp: import("backend-plus").ExpressPlus, baseUrl: string) => void) & ((mainApp: import("backend-plus").ExpressPlus, baseUrl: string) => void);
        addLoggedServices: (() => void) & (() => void);
        inDbClient: (<T_1>(req: import("backend-plus").Request, doThisWithDbClient: (client: import("pg-promise-strict").Client) => Promise<T_1>) => Promise<T_1>) & (<T_1>(req: import("backend-plus").Request, doThisWithDbClient: (client: import("pg-promise-strict").Client) => Promise<T_1>) => Promise<T_1>);
        inTransaction: (<T_1>(req: import("backend-plus").Request, doThisWithDbTransaction: (client: import("pg-promise-strict").Client) => Promise<T_1>) => Promise<T_1>) & (<T_1>(req: import("backend-plus").Request, doThisWithDbTransaction: (client: import("pg-promise-strict").Client) => Promise<T_1>) => Promise<T_1>);
        procedureDefCompleter: ((procedureDef: import("backend-plus").ProcedureDef) => import("backend-plus").ProcedureDef) & ((procedureDef: import("backend-plus").ProcedureDef) => import("backend-plus").ProcedureDef);
        tableDefAdapt: ((tableDef: TableDefinition, context: import("backend-plus").Context) => TableDefinition) & ((tableDef: TableDefinition, context: import("backend-plus").Context) => TableDefinition);
        pushApp: ((dirname: string) => void) & ((dirname: string) => void);
        dumpDbSchemaPartial: ((partialTableStructures: TableDefinitions, opts?: {
            complete?: boolean;
            skipEnance?: boolean;
        }) => Promise<{
            mainSql: string;
            enancePart: string;
        }>) & ((partialTableStructures: TableDefinitions, opts?: {
            complete?: boolean;
            skipEnance?: boolean;
        }) => Promise<{
            mainSql: string;
            enancePart: string;
        }>);
        getContextForDump: (() => import("backend-plus").ContextForDump) & (() => import("backend-plus").ContextForDump);
        getClientSetupForSendToFrontEnd: ((req: import("backend-plus").Request) => import("backend-plus").ClientSetup) & ((req: import("backend-plus").Request) => import("backend-plus").ClientSetup);
        configList: (() => (string | object)[]) & (() => (string | object)[]);
        setStaticConfig: ((defConfigYamlString: string) => void) & ((defConfigYamlString: string) => void);
    };
} & T;
export declare var AppVarCal: {
    new (...args: any[]): {
        configStaticConfig(): void;
        generateAndLoadTableDefs(): TableDefinitions;
        generateBaseTableDef(tablaDatos: TablaDatos): TableDefinition;
        prepareGetTables(): void;
        getMenu(): MenuDefinition;
        allProcedures: import("backend-plus").ProcedureDef[];
        allClientFileNames: import("backend-plus").ClientModuleDefinition[];
        tablasDatos: any[];
        cargarGenerados(client: import("pg-promise-strict").Client): Promise<string>;
        postConfig: (() => Promise<void>) & ((...params: any[]) => any);
        getTableDefFunction(tableDef: TableDefinition): import("backend-plus").TableDefinitionFunction;
        loadTableDef(tableDef: TableDefinition): import("backend-plus").TableDefinitionFunction;
        generateAndLoadTableDef(tablaDatos: any): import("backend-plus").TableDefinitionFunction;
        getProcedures: (() => Promise<import("backend-plus").ProcedureDef[]>) & (() => Promise<import("backend-plus").ProcedureDef[]>);
        clientIncludes: ((req: import("backend-plus").Request, hideBEPlusInclusions: boolean) => import("backend-plus").ClientModuleDefinition[]) & ((req: import("backend-plus").Request, hideBEPlusInclusions?: boolean) => import("backend-plus").ClientModuleDefinition[]);
        procedures: import("backend-plus").ProcedureDef[];
        procedure: {
            [key: string]: import("backend-plus").ProcedureDef;
        } & {
            [key: string]: import("backend-plus").ProcedureDef;
        };
        app: import("backend-plus").ExpressPlus;
        getTableDefinition: import("backend-plus").TableDefinitionsGetters;
        tableStructures: TableDefinitions;
        db: typeof import("pg-promise-strict");
        config: any;
        rootPath: string;
        start: ((opts?: import("backend-plus").StartOptions) => Promise<void>) & ((opts?: import("backend-plus").StartOptions) => Promise<void>);
        getTables: (() => import("backend-plus").TableItemDef[]) & (() => import("backend-plus").TableItemDef[]);
        appendToTableDefinition: ((tableName: string, appenderFunction: (tableDef: TableDefinition, context?: import("backend-plus").TableContext) => void) => void) & ((tableName: string, appenderFunction: (tableDef: TableDefinition, context?: import("backend-plus").TableContext) => void) => void);
        getContext: ((req: import("backend-plus").Request) => import("backend-plus").Context) & ((req: import("backend-plus").Request) => import("backend-plus").Context);
        addSchrödingerServices: ((mainApp: import("backend-plus").ExpressPlus, baseUrl: string) => void) & ((mainApp: import("backend-plus").ExpressPlus, baseUrl: string) => void);
        addUnloggedServices: ((mainApp: import("backend-plus").ExpressPlus, baseUrl: string) => void) & ((mainApp: import("backend-plus").ExpressPlus, baseUrl: string) => void);
        addLoggedServices: (() => void) & (() => void);
        inDbClient: (<T>(req: import("backend-plus").Request, doThisWithDbClient: (client: import("pg-promise-strict").Client) => Promise<T>) => Promise<T>) & (<T>(req: import("backend-plus").Request, doThisWithDbClient: (client: import("pg-promise-strict").Client) => Promise<T>) => Promise<T>);
        inTransaction: (<T>(req: import("backend-plus").Request, doThisWithDbTransaction: (client: import("pg-promise-strict").Client) => Promise<T>) => Promise<T>) & (<T>(req: import("backend-plus").Request, doThisWithDbTransaction: (client: import("pg-promise-strict").Client) => Promise<T>) => Promise<T>);
        procedureDefCompleter: ((procedureDef: import("backend-plus").ProcedureDef) => import("backend-plus").ProcedureDef) & ((procedureDef: import("backend-plus").ProcedureDef) => import("backend-plus").ProcedureDef);
        tableDefAdapt: ((tableDef: TableDefinition, context: import("backend-plus").Context) => TableDefinition) & ((tableDef: TableDefinition, context: import("backend-plus").Context) => TableDefinition);
        pushApp: ((dirname: string) => void) & ((dirname: string) => void);
        dumpDbSchemaPartial: ((partialTableStructures: TableDefinitions, opts?: {
            complete?: boolean;
            skipEnance?: boolean;
        }) => Promise<{
            mainSql: string;
            enancePart: string;
        }>) & ((partialTableStructures: TableDefinitions, opts?: {
            complete?: boolean;
            skipEnance?: boolean;
        }) => Promise<{
            mainSql: string;
            enancePart: string;
        }>);
        getContextForDump: (() => import("backend-plus").ContextForDump) & (() => import("backend-plus").ContextForDump);
        getClientSetupForSendToFrontEnd: ((req: import("backend-plus").Request) => import("backend-plus").ClientSetup) & ((req: import("backend-plus").Request) => import("backend-plus").ClientSetup);
        configList: (() => (string | object)[]) & (() => (string | object)[]);
        setStaticConfig: ((defConfigYamlString: string) => void) & ((defConfigYamlString: string) => void);
    };
} & {
    new (...args: any[]): {
        allProcedures: import("backend-plus").ProcedureDef[];
        allClientFileNames: import("backend-plus").ClientModuleDefinition[];
        tablasDatos: any[];
        configStaticConfig(): void;
        cargarGenerados(client: import("pg-promise-strict").Client): Promise<string>;
        postConfig(): Promise<void>;
        generateBaseTableDef(tablaDatos: any): TableDefinition;
        getTableDefFunction(tableDef: TableDefinition): import("backend-plus").TableDefinitionFunction;
        loadTableDef(tableDef: TableDefinition): import("backend-plus").TableDefinitionFunction;
        generateAndLoadTableDef(tablaDatos: any): import("backend-plus").TableDefinitionFunction;
        getProcedures(): Promise<import("backend-plus").ProcedureDef[]>;
        clientIncludes(req: import("backend-plus").Request, hideBEPlusInclusions: boolean): import("backend-plus").ClientModuleDefinition[];
        getMenu(): MenuDefinition;
        prepareGetTables(): void;
        procedures: import("backend-plus").ProcedureDef[];
        procedure: {
            [key: string]: import("backend-plus").ProcedureDef;
        };
        app: import("backend-plus").ExpressPlus;
        getTableDefinition: import("backend-plus").TableDefinitionsGetters;
        tableStructures: TableDefinitions;
        db: typeof import("pg-promise-strict");
        config: any;
        rootPath: string;
        start(opts?: import("backend-plus").StartOptions): Promise<void>;
        getTables(): import("backend-plus").TableItemDef[];
        appendToTableDefinition(tableName: string, appenderFunction: (tableDef: TableDefinition, context?: import("backend-plus").TableContext) => void): void;
        getContext(req: import("backend-plus").Request): import("backend-plus").Context;
        addSchrödingerServices(mainApp: import("backend-plus").ExpressPlus, baseUrl: string): void;
        addUnloggedServices(mainApp: import("backend-plus").ExpressPlus, baseUrl: string): void;
        addLoggedServices(): void;
        inDbClient<T_1>(req: import("backend-plus").Request, doThisWithDbClient: (client: import("pg-promise-strict").Client) => Promise<T_1>): Promise<T_1>;
        inTransaction<T_1>(req: import("backend-plus").Request, doThisWithDbTransaction: (client: import("pg-promise-strict").Client) => Promise<T_1>): Promise<T_1>;
        procedureDefCompleter(procedureDef: import("backend-plus").ProcedureDef): import("backend-plus").ProcedureDef;
        tableDefAdapt(tableDef: TableDefinition, context: import("backend-plus").Context): TableDefinition;
        pushApp(dirname: string): void;
        dumpDbSchemaPartial(partialTableStructures: TableDefinitions, opts?: {
            complete?: boolean;
            skipEnance?: boolean;
        }): Promise<{
            mainSql: string;
            enancePart: string;
        }>;
        getContextForDump(): import("backend-plus").ContextForDump;
        getClientSetupForSendToFrontEnd(req: import("backend-plus").Request): import("backend-plus").ClientSetup;
        configList(): (string | object)[];
        setStaticConfig(defConfigYamlString: string): void;
    };
    prefixTableName(tableName: string, prefix: string): string;
} & typeof AppBackend;
export declare type AppVarCalType = InstanceType<typeof AppVarCal>;
//# sourceMappingURL=app-varcal.d.ts.map