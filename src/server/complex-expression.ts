import * as EP from "expre-parser";
import { Relacion, TablaDatos} from "operativos";
// import { BaseNode, Insumos } from "expre-parser";

export class ComplexExpression{
    // private validateOverwritingNames(insumos: Insumos): void {
    //     if (insumos.funciones) {
    //         insumos.variables.forEach(varName => {
    //             if (insumos.funciones.indexOf(varName) > -1) {
    //                 throw new Error('La variable "' + varName + '" es también un nombre de función');
    //             }
    //         })
    //     }
    // }
    // private validateFunctions(funcNames: string[]) {
    //     let pgWhiteList = ['div', 'avg', 'count', 'max', 'min', 'sum', 'coalesce'];
    //     let comunSquemaWhiteList = ['informado'];
    //     let functionWhiteList = pgWhiteList.concat(comunSquemaWhiteList);
    //     funcNames.forEach(f => {
    //         if (hasAlias(f)) {
    //             if (f.split('.')[0] != 'dbo') {
    //                 throw new Error('La Función ' + f + ' contiene un alias inválido');
    //             }
    //         } else {
    //             if (functionWhiteList.indexOf(f) == -1) {
    //                 throw new Error('La Función ' + f + ' no está incluida en la whiteList de funciones: ' + functionWhiteList.toString());
    //             }
    //         }
    //     })
    // }
    // validateInsumos(): void {
    //     this.validateOverwritingNames(this.insumos);
    //     this.validateFunctions(this.insumos.funciones);
    // }
    tdsNeedByExpression: string[] = [];
    
    expresionProcesada!: string
    insumos!: EP.Insumos; 
    
    insumosOptionalRelations: Relacion[] = [] 
    lastTD!:TablaDatos
    
    clausula_from!:string
    clausula_where!:string
    
    // constructor(public userExpression:string){
    //     this.setInsumos()
    //     this.validateInsumos()
    // }
    
    // private setInsumos(){
    //     let bn:BaseNode = EP.parse(this.userExpression); 
    //     this.insumos = bn.getInsumos();
    // }
}