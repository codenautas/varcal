import { CompilerOptions, Insumos } from "expre-parser";
import { Relacion, TablaDatos, TipoVarDB, Variable, VariableOpcion } from "operativos";
import { ExpressionContainer } from "./expression-container";
export declare let compilerOptions: CompilerOptions;
export declare class VariableCalculada extends Variable implements ExpressionContainer, TipoVarDB {
    expresionValidada: string;
    rawExpression: string;
    insumos: Insumos;
    orderedInsumosTDNames: string[];
    notOrderedInsumosOptionalRelations: Relacion[];
    lastTD: TablaDatos;
    firstTD: TablaDatos;
    clausula_from: string;
    clausula_where: string;
    opciones?: VariableOpcion[];
    getExpression(): string;
    esCalculada(): boolean;
    parseExpression(): Promise<void>;
}
export declare class BloqueVariablesCalc {
    tabla: TablaDatos;
    variablesCalculadas: VariableCalculada[];
    constructor(vCalc: VariableCalculada);
}
//# sourceMappingURL=variable-calculada.d.ts.map