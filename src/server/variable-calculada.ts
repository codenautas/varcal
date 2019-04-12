import * as EP from "expre-parser";
import { CompilerOptions } from "expre-parser";
import { OperativoGenerator, Relacion, TablaDatos, TipoVarDB, Variable, VariableOpcion } from "operativos";
import { IExpressionContainer } from "./expression-container";
import { VarCalculator } from "./var-calculator";

//TODO: quit this global var
export let compilerOptions: CompilerOptions = { language: 'sql', varWrapper: 'null2zero', divWrapper: 'div0err', elseWrapper: 'lanzar_error' };

export class VariableCalculada extends Variable implements TipoVarDB, IExpressionContainer{
    tdsNeedByExpression: string[]= [];
    
    expressionProcesada!: string
    insumos!: EP.Insumos; 
    
    orderedInsumosTDNames: string[] = []
    insumosOptionalRelations: Relacion[] = []
    lastTD!:TablaDatos
    
    opciones?: VariableOpcion[]
    // complexExp!:ComplexExpression
    
    public buildSetClausule():string {
        let expresion = (this.tabla_agregada && this.funcion_agregacion) ?
            `${this.tabla_agregada + OperativoGenerator.sufijo_agregacion}.${this.variable}` :
            this.expressionProcesada;
        return `${this.variable} = ${expresion}`;
    }
        
    validate() {
        if ((!this.opciones || !this.opciones.length) && !this.expresion) {
            throw new Error('La variable ' + this.variable + ' no puede tener expresión y opciones nulas simultaneamente');
        };
        if (this.tabla_agregada && ! this.funcion_agregacion) {
            throw new Error('En la variable "' + this.variable + '" debe completar campo funcion_agregacion ya que tiene completo el campo tabla_agregada.');
        }
        if ( ! this.tabla_agregada && this.funcion_agregacion) {
            throw new Error('En la variable "' + this.variable + '" debe completar campo tabla_agregada ya que tiene completo el campo funcion_agregacion.');
        }
    }

    fusionUserExpressions(): void {
        this.expresion=this.expresion||'';
        if (this.opciones && this.opciones.length) {
            this.expressionProcesada = 'CASE ' + this.opciones.map(opcion => {
                return '\n          WHEN ' + opcion.expresion_condicion +
                    ' THEN ' + opcion.expresion_valor || opcion.opcion
            }).join('') + (this.expresion ? '\n          ELSE ' + this.expresion : '') + ' END'
        } else {
            this.expressionProcesada = this.expresion;
        }
        if (this.filtro) {
            this.expressionProcesada = 'CASE WHEN ' + this.filtro + ' THEN ' + this.expressionProcesada + ' ELSE NULL END'
        }
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