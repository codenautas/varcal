import * as EP from "expre-parser";
import { Relacion } from "operativos";

export interface IExpressionContainer{
    tdsInvolvedInExpr: string[];

    expresionProcesada: string
    insumos: EP.Insumos; 
    
    insumosOptionalRelations: Relacion[] 
    first_td?:string;
    last_td?:string;

    fusionUserExpressions():void;
}