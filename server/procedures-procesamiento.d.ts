import { ProcedureContext } from "backend-plus";
declare type OrigenesGenerarParameters = {
    operativo: string;
    origen: string;
};
declare var ProceduresProcesamiento: {
    action: string;
    parameters: any[];
    coreFunction: (context: ProcedureContext, parameters: OrigenesGenerarParameters) => Promise<string>;
}[];
export { ProceduresProcesamiento };
