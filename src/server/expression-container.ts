import * as EP from "expre-parser";
import { Relacion, TablaDatos } from "operativos";

export interface ExpressionContainer{
    tdsNeedByExpression: string[];

    expresionValidada: string
    insumos: EP.Insumos; 
    
    orderedInsumosTDNames: string[]
    insumosOptionalRelations: Relacion[] 
    lastTD:TablaDatos

    clausula_from:string
    clausula_where:string

    getExpression():string

}