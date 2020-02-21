import * as EP from "expre-parser";
import { Relacion, TablaDatos, TipoVarDB, Variable, VariableOpcion, OperativoGenerator } from "operativos";
import { IExpressionContainer } from "./expression-container";
import { VarCalculator } from "./var-calculator";

export class VariableCalculada extends Variable implements TipoVarDB, IExpressionContainer{
    
    tdsInvolvedInExpr: string[]= [];
    
    expresionProcesada!: string
    insumos!: EP.Insumos; 
    
    insumosOptionalRelations: Relacion[] = []
    opciones?: VariableOpcion[]
    first_td!:string
    last_td!:string    

    getAggTableSufix() {
        if (this.funcion_agregacion != 'completar'){
            return OperativoGenerator.sufijo_agregacion
        } else {
            return OperativoGenerator.sufijo_complete
        }
    }

    parseAggregation() {
        const tdPks = VarCalculator.instanceObj.getUniqueTD(<string>this.tabla_agregada).pks;
        // TODO: For those which just change the function name extract common factor
        switch (this.funcion_agregacion) {
            case 'sumar':
                return 'sum(' + this.expresionProcesada + ')';
            case 'min':
                return 'min(' + this.expresionProcesada + ')';
            case 'max':
                return 'max(' + this.expresionProcesada + ')';
            case 'promediar':
                return 'avg(' + this.expresionProcesada + ')';
            case 'primero':
                return `first(${this.expresionProcesada} order by ${this.expresion})`;
            case 'contar':
                return 'count(nullif(' + this.expresionProcesada + ',false))';
            case 'ultimo':
                return `last_agg(${this.expresionProcesada} order by ${tdPks.join(',')})`;
            case 'completar':
                return `last_agg(${this.expresionProcesada}) OVER (PARTITION BY ${tdPks.slice(0,-1).join(',')} order by ${tdPks[tdPks.length-1]})`;
            default:
                return this.funcion_agregacion + '(' + this.expresionProcesada + ')';
        }
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
                    ' THEN ' + (opcion.expresion_valor || opcion.opcion)
            }).join('') + (this.expresion ? '\n          ELSE ' + this.expresion : '') + ' END'
        } else {
            this.expresionProcesada = this.expresion;
        }
        if (this.filtro) {
            // TODO: analice use filter for aggregated function instead of case when 
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

    getTDsInvolved(){
        let tdsInvolved:string[] = this.variablesCalculadas.flatMap(vc=>vc.tdsInvolvedInExpr);
        tdsInvolved.push(this.tabla.td_base);
        tdsInvolved = [...new Set(tdsInvolved)] // removing duplicated
        return tdsInvolved
    }

    getOptInsumos() {
        // flatening nested array
        let insumosOptionalRelations = ([] as Relacion[]).concat(...(this.variablesCalculadas.map(vc=>vc.insumosOptionalRelations)));
        //removing duplicated
        insumosOptionalRelations = [...(new Set(insumosOptionalRelations))];
        return insumosOptionalRelations;
    }
}