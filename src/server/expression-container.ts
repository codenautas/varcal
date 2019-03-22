import * as EP from "expre-parser";
import { Relacion, TablaDatos } from "operativos";

export abstract class ExpressionContainer{
    rawExpression: string
    insumos: EP.Insumos; 
    
    orderedInsumosTDNames: string[]
    notOrderedInsumosOptionalRelations: Relacion[] 
    lastTD:TablaDatos
    firstTD:TablaDatos

    clausula_from:string
    clausula_where:string

    prepare(){
        // expre-parse to check for bad sql
        let bn:EP.BaseNode = EP.parse(this.getExpression()); 
        this.insumos = bn.getInsumos();
    }

    abstract getExpression():string

    getInsumosAliases() {
        return this.insumos.aliases;
    }
}