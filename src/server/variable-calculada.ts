import * as EP from "expre-parser";
import { OperativoGenerator, Relacion, TablaDatos, TipoVarDB, Variable, VariableOpcion } from "operativos";
import { IExpressionContainer } from "./expression-container";
import { VarCalculator } from "./var-calculator";

export class VariableCalculada extends Variable implements TipoVarDB, IExpressionContainer{
    tdsNeedByExpression: string[]= [];
    
    expresionProcesada!: string
    insumos!: EP.Insumos; 
    
    orderedInsumosTDNames: string[] = []
    insumosOptionalRelations: Relacion[] = []
    lastTD!:TablaDatos
    
    opciones?: VariableOpcion[]
    // complexExp!:ComplexExpression
    
    public buildSetClausule():string {
        let expresion = (this.tabla_agregada && this.funcion_agregacion) ?
            `${this.tabla_agregada + OperativoGenerator.sufijo_agregacion}.${this.variable}` :
            this.expresionProcesada;
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
            this.expresionProcesada = 'CASE ' + this.opciones.map(opcion => {
                return '\n          WHEN ' + opcion.expresion_condicion +
                    ' THEN ' + opcion.expresion_valor || opcion.opcion
            }).join('') + (this.expresion ? '\n          ELSE ' + this.expresion : '') + ' END'
        } else {
            this.expresionProcesada = this.expresion;
        }
        if (this.filtro) {
            this.expresionProcesada = 'CASE WHEN ' + this.filtro + ' THEN ' + this.expresionProcesada + ' ELSE NULL END'
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