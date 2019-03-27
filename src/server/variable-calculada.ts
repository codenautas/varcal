import { CompilerOptions, Insumos } from "expre-parser";
import { Relacion, TablaDatos, tiposTablaDato, TipoVarDB, Variable, VariableOpcion } from "operativos";
import { ExpressionContainer } from "./expression-container";
import { VarCalculator } from "./var-calculator";

//TODO: quit this global var
export let compilerOptions: CompilerOptions = { language: 'sql', varWrapper: 'null2zero', divWrapper: 'div0err', elseWrapper: 'lanzar_error' };

export class VariableCalculada extends Variable implements ExpressionContainer, TipoVarDB{
    //TODO: elegir uno
    expresionValidada: string
    rawExpression: string

    insumos: Insumos; 
    
    orderedInsumosTDNames: string[] = []
    notOrderedInsumosOptionalRelations: Relacion[] = []
    lastTD:TablaDatos
    firstTD:TablaDatos

    clausula_from:string
    clausula_where:string
       
    opciones?: VariableOpcion[]    

    getExpression(){
        return this.expresion;
    }

    esCalculada(){
        return this.clase == tiposTablaDato.calculada;
    }

    async parseExpression() {
        if ((!this.opciones || !this.opciones.length) && !this.expresion) {
            throw new Error('La variable ' + this.variable + ' no puede tener expresión y opciones nulas simultaneamente');
        }
        let tdPks = VarCalculator.instanceObj.getTDFor(this).getQuotedPKsCSV();
        if (this.opciones && this.opciones.length) {
            this.expresionValidada = 'CASE ' + this.opciones.map(function (opcion: VariableOpcion) {
                return '\n          WHEN ' + getWrappedExpression(opcion.expresion_condicion, tdPks, compilerOptions) +
                    ' THEN ' + getWrappedExpression(opcion.expresion_valor || opcion.opcion, tdPks, compilerOptions)
            }).join('') + (this.expresion ? '\n          ELSE ' + getWrappedExpression(this.expresion, tdPks, compilerOptions) : '') + ' END'
        } else {
            this.expresionValidada = getWrappedExpression(this.expresion, tdPks, compilerOptions);
        }
        if (this.filtro) {
            this.expresionValidada = 'CASE WHEN ' + this.filtro + ' THEN ' + this.expresionValidada + ' ELSE NULL END'
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