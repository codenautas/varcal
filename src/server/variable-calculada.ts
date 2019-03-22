import { TablaDatos, Variable, VariableDB, Client, tiposTablaDato, VariableOpcion, TipoVarDB, PgKnownTypes } from "operativos";
import { VarCalculator } from "./var-calculator";
import { ExpressionContainer } from "./expression-container";
import { Insumos, CompilerOptions } from "expre-parser";

//TODO: quit this global var
export let compilerOptions: CompilerOptions = { language: 'sql', varWrapper: 'null2zero', divWrapper: 'div0err', elseWrapper: 'lanzar_error' };

export class VariableCalculada extends ExpressionContainer implements VariableDB, TipoVarDB{
    // @ts-ignore https://github.com/codenautas/operativos/issues/4
    operativo          :string
    // @ts-ignore https://github.com/codenautas/operativos/issues/4
    tabla_datos        :string
    // @ts-ignore https://github.com/codenautas/operativos/issues/4
    variable           :string
    abr?                :string
    nombre?             :string
    // @ts-ignore https://github.com/codenautas/operativos/issues/4
    tipovar            :string
    // @ts-ignore https://github.com/codenautas/operativos/issues/4
    clase              :string
    es_pk?              :number
    es_nombre_unico?    :boolean
    activa?             :boolean
    filtro?             :string
    expresion?          :string
    cascada?            :string
    nsnc_atipico?       :number
    cerrada?            :boolean
    funcion_agregacion? :string
    tabla_agregada?     :string
    grupo?              :string
    orden? : number

    // @ts-ignore https://github.com/codenautas/operativos/issues/4
    tipovar: string
    // @ts-ignore https://github.com/codenautas/operativos/issues/4
    html_type: string
    // @ts-ignore https://github.com/codenautas/operativos/issues/4
    type_name: PgKnownTypes
    // @ts-ignore https://github.com/codenautas/operativos/issues/4
    validar: string
    // @ts-ignore https://github.com/codenautas/operativos/issues/4
    radio: boolean
    
   
    opciones?: VariableOpcion[]

    insumos: Insumos
    expresionValidada: string

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