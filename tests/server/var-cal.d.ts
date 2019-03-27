import * as ExpresionParser from 'expre-parser';
export declare function getAggregacion(f: string, exp: string): string;
export declare function getInsumos(expression: string): ExpresionParser.Insumos;
export declare function getWrappedExpression(expression: string | number, pkExpression: string, options: ExpresionParser.CompilerOptions): string;
export declare const sufijo_agregacion: string;
export interface AliasDefEst {
    on: string;
    tabla_datos: string;
    where?: string;
}
export interface Alias extends AliasDefEst {
    operativo: string;
    alias: string;
    descripcion?: string;
}
export declare type PrefixedPks = {
    [key: string]: {
        pks: string[];
        pksString: string;
    };
};
export interface Join {
    tabla: string;
    clausulaJoin: string;
}
export declare type TextoSQL = string;
export interface Aliases {
    [key: string]: AliasDefEst;
}
//# sourceMappingURL=var-cal.d.ts.map