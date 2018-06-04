import { ProcedureContext } from "backend-plus";
declare type OrigenesGenerarParameters = {
    operativo: string;
    origen: string;
};
declare var ProceduresProcesamiento: {
    action: string;
    parameters: {
        name: string;
        typeName: string;
        references: string;
    }[];
    coreFunction: (context: ProcedureContext, parameters: OrigenesGenerarParameters) => Promise<string>;
}[];
export { ProceduresProcesamiento };
