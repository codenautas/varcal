"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ExpresionParser = require("expre-parser");
function getAggregacion(f, exp) {
    switch (f) {
        case 'sumar':
            return 'sum(' + exp + ')';
        case 'min':
            return 'min(' + exp + ')';
        case 'max':
            return 'max(' + exp + ')';
        case 'contar':
            return 'count(nullif(' + exp + ',false))';
        case 'promediar':
            return 'avg(' + exp + ')';
        default:
            return f + '(' + exp + ')';
    }
}
exports.getAggregacion = getAggregacion;
function getInsumos(expression) {
    return ExpresionParser.parse(expression).getInsumos();
}
exports.getInsumos = getInsumos;
function getWrappedExpression(expression, pkExpression, options) {
    var compiler = new ExpresionParser.Compiler(options);
    return compiler.toCode(ExpresionParser.parse(expression), pkExpression);
}
exports.getWrappedExpression = getWrappedExpression;
exports.sufijo_agregacion = '_agg';
;
//# sourceMappingURL=var-cal.js.map