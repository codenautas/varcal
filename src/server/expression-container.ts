import * as EP from "expre-parser";
import { Relacion, TablaDatos } from "operativos";

export interface ExpressionContainer{
    rawExpression: string
    insumos: EP.Insumos; 
    
    orderedInsumosTDNames: string[]
    notOrderedInsumosOptionalRelations: Relacion[] 
    lastTD:TablaDatos
    firstTD:TablaDatos

    clausula_from:string
    clausula_where:string

    abstract getExpression():string

}