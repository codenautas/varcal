// import { ComplexExpression } from "complex-expression";
import * as EP from "expre-parser";
import { Relacion, TablaDatos } from "operativos";

export interface IExpressionContainer{
    // complexExp: ComplexExpression;
    tdsNeedByExpression: string[];

    expressionProcesada: string
    insumos: EP.Insumos; 
    
    orderedInsumosTDNames: string[]
    insumosOptionalRelations: Relacion[] 
    lastTD:TablaDatos

    fusionUserExpressions():void;
}