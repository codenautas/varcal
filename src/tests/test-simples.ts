import * as discrepances from 'discrepances';
import 'mocha';

import { VariableCalculada } from '../server/app-varcal';

// Los tests que necesitan base de datos no están acá: sólo se prueba lo que no depende de PostgreSQL.

function nuevaVariable(def: Partial<VariableCalculada>): VariableCalculada {
    return Object.assign(Object.create(VariableCalculada.prototype), def) as VariableCalculada;
}

function mensajeDeError(f: () => void): string {
    try {
        f();
    } catch (err) {
        return (err as Error).message;
    }
    throw new Error('Tenía que dar error');
}

describe("varcal", function () {
    describe("fusionUserExpressions", function () {
        it("sin opciones deja la expresión tal cual", function () {
            var v = nuevaVariable({ variable: 'v', expresion: 'a + b' });
            v.fusionUserExpressions();
            discrepances.showAndThrow(v.expresionProcesada, 'a + b');
        });
        it("con opciones arma un CASE", function () {
            var v = nuevaVariable({ variable: 'v', opciones: [
                { opcion: 1, expresion_condicion: 'a > 1' },
                { opcion: 2, expresion_condicion: 'a > 0', expresion_valor: '5' },
            ] as VariableCalculada['opciones'] });
            v.fusionUserExpressions();
            discrepances.showAndThrow(
                v.expresionProcesada,
                'CASE \n          WHEN a > 1 THEN 1\n          WHEN a > 0 THEN 5 END'
            );
        });
        it("con opciones y expresión agrega el ELSE", function () {
            var v = nuevaVariable({ variable: 'v', expresion: 'b', opciones: [
                { opcion: 1, expresion_condicion: 'a > 1' },
            ] as VariableCalculada['opciones'] });
            v.fusionUserExpressions();
            discrepances.showAndThrow(
                v.expresionProcesada,
                'CASE \n          WHEN a > 1 THEN 1\n          ELSE b END'
            );
        });
        it("con filtro envuelve la expresión en un CASE", function () {
            var v = nuevaVariable({ variable: 'v', expresion: 'a + b', filtro: 'c > 0' });
            v.fusionUserExpressions();
            discrepances.showAndThrow(v.expresionProcesada, 'CASE WHEN c > 0 THEN a + b ELSE NULL END');
        });
    });
    describe("validate", function () {
        it("acepta una variable con expresión", function () {
            nuevaVariable({ variable: 'v', expresion: 'a + b' }).validate();
        });
        it("protesta si no hay expresión ni opciones", function () {
            discrepances.showAndThrow(
                mensajeDeError(() => nuevaVariable({ variable: 'v' }).validate()),
                'La variable v no puede tener expresión y opciones nulas simultaneamente'
            );
        });
        it("protesta si hay tabla_agregada sin funcion_agregacion", function () {
            discrepances.showAndThrow(
                mensajeDeError(() => nuevaVariable({ variable: 'v', expresion: 'a', tabla_agregada: 't' }).validate()),
                'En la variable "v" debe completar campo funcion_agregacion ya que tiene completo el campo tabla_agregada.'
            );
        });
        it("protesta si hay funcion_agregacion sin tabla_agregada", function () {
            discrepances.showAndThrow(
                mensajeDeError(() => nuevaVariable({ variable: 'v', expresion: 'a', funcion_agregacion: 'sumar' }).validate()),
                'En la variable "v" debe completar campo tabla_agregada ya que tiene completo el campo funcion_agregacion.'
            );
        });
    });
});
