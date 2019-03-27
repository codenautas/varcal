import { ProcedureContext } from "./types-varcal";
declare var procedures: {
    action: string;
    parameters: {
        name: string;
        typeName: string;
        references: string;
    }[];
    coreFunction: (context: ProcedureContext, parameters: {
        operativo: string;
    }) => Promise<string>;
}[];
export { procedures };
//# sourceMappingURL=procedures-varcal.d.ts.map