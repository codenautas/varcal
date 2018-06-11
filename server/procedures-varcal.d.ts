import * as VarCal from "./var-cal";
import * as operativos from "operativos";
export interface coreFunctionParameters {
    operativo: string;
}
export declare type CoreFunction = (context: operativos.ProcedureContext, parameters: coreFunctionParameters) => Promise<VarCal.DefinicionEstructural>;
declare var ProceduresVarCal: ({
    action: string;
    parameters: {
        name: string;
        references: string;
        typeName: string;
    }[];
    coreFunction: (context: operativos.ProcedureContext, parameters: coreFunctionParameters) => Promise<VarCal.DefinicionEstructural>;
} | {
    action: string;
    parameters: {
        name: string;
        typeName: string;
        references: string;
    }[];
    coreFunction: (context: operativos.ProcedureContext, parameters: coreFunctionParameters) => Promise<string>;
})[];
export { ProceduresVarCal };
