"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const operativos_1 = require("operativos");
const var_calculator_1 = require("./var-calculator");
//TODO: quit this global var
exports.compilerOptions = { language: 'sql', varWrapper: 'null2zero', divWrapper: 'div0err', elseWrapper: 'lanzar_error' };
class VariableCalculada extends operativos_1.Variable {
    getExpression() {
        return this.expresion;
    }
    esCalculada() {
        return this.clase == operativos_1.tiposTablaDato.calculada;
    }
    async parseExpression() {
        if ((!this.opciones || !this.opciones.length) && !this.expresion) {
            throw new Error('La variable ' + this.variable + ' no puede tener expresión y opciones nulas simultaneamente');
        }
        let tdPks = var_calculator_1.VarCalculator.instanceObj.getTDFor(this).getQuotedPKsCSV();
        if (this.opciones && this.opciones.length) {
            this.expresionValidada = 'CASE ' + this.opciones.map(function (opcion) {
                return '\n          WHEN ' + getWrappedExpression(opcion.expresion_condicion, tdPks, exports.compilerOptions) +
                    ' THEN ' + getWrappedExpression(opcion.expresion_valor || opcion.opcion, tdPks, exports.compilerOptions);
            }).join('') + (this.expresion ? '\n          ELSE ' + getWrappedExpression(this.expresion, tdPks, exports.compilerOptions) : '') + ' END';
        }
        else {
            this.expresionValidada = getWrappedExpression(this.expresion, tdPks, exports.compilerOptions);
        }
        if (this.filtro) {
            this.expresionValidada = 'CASE WHEN ' + this.filtro + ' THEN ' + this.expresionValidada + ' ELSE NULL END';
        }
    }
}
exports.VariableCalculada = VariableCalculada;
class BloqueVariablesCalc {
    constructor(vCalc) {
        this.tabla = var_calculator_1.VarCalculator.instanceObj.getUniqueTD(vCalc.tabla_datos);
        this.variablesCalculadas = [vCalc];
    }
}
exports.BloqueVariablesCalc = BloqueVariablesCalc;
//# sourceMappingURL=variable-calculada.js.map