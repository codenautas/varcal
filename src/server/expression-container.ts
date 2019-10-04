// import { ComplexExpression } from "complex-expression";
import * as EP from "expre-parser";
import { Relacion, TablaDatos } from "operativos";

export interface IExpressionContainer{
    // complexExp: ComplexExpression;
    tdsNeedByExpression: string[];

    expresionProcesada: string
    insumos: EP.Insumos; 
    
    insumosOptionalRelations: Relacion[] 
    lastTD:TablaDatos

    fusionUserExpressions():void;
}