import * as operativos from "operativos";
declare type OrigenesGenerarParameters = {
    operativo: string;
    origen: string;
};
declare var ProceduresVarCal: {
    action: string;
    parameters: {
        name: string;
        typeName: string;
        references: string;
    }[];
    coreFunction: (context: operativos.ProcedureContext, parameters: OrigenesGenerarParameters) => Promise<string>;
}[];
export { ProceduresVarCal };
