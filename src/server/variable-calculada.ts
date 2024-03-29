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
        if (this.funcion_agregacion?.includes('completar')){
            return OperativoGenerator.sufijo_complete
        } else {
            return OperativoGenerator.sufijo_agregacion
        }
    }

    parseAggregation() {
        const tdPks = VarCalculator.instanceObj.getUniqueTD(<string>this.tabla_agregada).pks;
        const lastPk = tdPks[tdPks.length-1];
        let defaultElseValue;
        switch (this.tipovar) {
            case 'numero': defaultElseValue = '0'; break;
            default: defaultElseValue = 'null'; break;
        } 
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
                return `last_agg(CASE WHEN ${this.expresionProcesada} is null and ${lastPk} = 0 THEN 0 ELSE ${this.expresionProcesada} END) 
                        OVER (PARTITION BY ${tdPks.slice(0,-1).join(',')} order by ${lastPk})`;
            case 'completar_dinamico':
                return `CASE
                    WHEN ${this.filtro} THEN last_agg(${this.expresionProcesada}) OVER (PARTITION BY ${tdPks.slice(0,-1).join(',')} order by ${lastPk})
                    ELSE ${defaultElseValue} END`;
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
        tdsInvolved = tdsInvolved.filter(tdName=>tdName !== this.tabla.tabla_datos) // removing bloque td to update, for avoid join with this updated table
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