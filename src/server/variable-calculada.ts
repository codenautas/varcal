import { CompilerOptions, Insumos } from "expre-parser";
import { OperativoGenerator, Relacion, TablaDatos, TipoVarDB, Variable, VariableOpcion } from "operativos";
import { ExpressionContainer } from "./expression-container";
import { VarCalculator } from "./var-calculator";

//TODO: quit this global var
export let compilerOptions: CompilerOptions = { language: 'sql', varWrapper: 'null2zero', divWrapper: 'div0err', elseWrapper: 'lanzar_error' };

export class VariableCalculada extends Variable implements ExpressionContainer, TipoVarDB{

    tdsNeedByExpression: string[] = [];
    orderedInsumosTDNames: string[] = []
    insumosOptionalRelations: Relacion[] = []
       
    opciones?: VariableOpcion[]    

    constructor(public expresionValidada:string, public insumos: Insumos, public lastTD:TablaDatos, public clausula_from:string, public clausula_where:string ){
        super();
    }
    
    public buildSetClausule():string {
        let expresion = (this.tabla_agregada && this.funcion_agregacion) ?
            `${this.tabla_agregada + OperativoGenerator.sufijo_agregacion}.${this.variable}` :
            this.expresionValidada;
        return `${this.variable} = ${expresion}`;
    }

    getExpression(){
        return this.expresion || '';
    }
}



export class BloqueVariablesCalc {
    tabla: TablaDatos
    variablesCalculadas: VariableCalculada[]

    constructor(vCalc: VariableCalculada) {
        this.tabla = VarCalculator.instanceObj.getUniqueTD(vCalc.tabla_datos);
        this.variablesCalculadas = [vCalc]
    }
}