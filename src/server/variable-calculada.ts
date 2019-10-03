import * as EP from "expre-parser";
import { Relacion, TablaDatos, TipoVarDB, Variable, VariableOpcion, OperativoGenerator } from "operativos";
import { IExpressionContainer } from "./expression-container";
import { VarCalculator } from "./var-calculator";
import { jsWhiteList } from "./expression-processor";

export class VariableCalculada extends Variable implements TipoVarDB, IExpressionContainer{
    tdsNeedByExpression: string[]= [];
    
    expresionProcesada!: string
    insumos!: EP.Insumos; 
    
    insumosOptionalRelations: Relacion[] = []
    lastTD!:TablaDatos
    
    opciones?: VariableOpcion[]
    // complexExp!:ComplexExpression
        
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

    replaceJSFunctions():void {
        this.insumos.funciones.filter(fname=>jsWhiteList.includes(fname)).forEach(f=>this.replaceJSFunction(f));
    }

    replaceJSFunction(fname:string):void{
        const varTD = OperativoGenerator.instanceObj.getTDFor(this);
        switch (fname) {
            case 'completar_valor_con_ultimo':
                const regex = new RegExp(fname+'\((.+)\)', 'g');
                this.expresionProcesada = this.expresionProcesada.replace(regex, 
                    `$1, last_agg($1) OVER 
                      (PARTITION BY ${varTD.getPKsWitAlias().slice(0,-1).join(',')} 
                        ORDER BY ${varTD.getPKsWitAlias()[varTD.getPKsWitAlias.length-1]}) ${this.nombre}`)
                break;
            default:
                break;
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