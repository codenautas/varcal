import { CompilerOptions, Insumos } from "expre-parser";
import { TablaDatos, Variable, VariableDB, VariableOpcion } from "operativos";
import { getInsumos, getWrappedExpression } from "./var-cal";
import { VarCalculator } from "./var-calculator";

//TODO: quit this global var
export let compilerOptions: CompilerOptions = { language: 'sql', varWrapper: 'null2zero', divWrapper: 'div0err', elseWrapper: 'lanzar_error' };

export class VariableCalculada extends Variable {
    insumos: Insumos
    expresionValidada: string

    static buildFromDBJSON(dbJson: VariableDB) {
        return Object.assign(new VariableCalculada, dbJson);
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
        this.insumos = getInsumos(this.expresionValidada);
    }
}

export class BloqueVariablesCalc {
    tabla: TablaDatos
    variablesCalculadas: VariableCalculada[]

    constructor(vCalc: VariableCalculada) {
        this.tabla = VarCalculator.instanceObj.myTDs.find(td=>td.tabla_datos==vCalc.tabla_datos);
        this.variablesCalculadas = [vCalc]
    }

    // //TODO: version vieja, ahora está adaptada
    // addAliasesToExpression(v: VariableCalculada, variablesDefinidas: Variable[]) {
    //     v.insumos.variables.forEach((varInsumoName: string) => {
    //         if (!hasAlias(varInsumoName) && (!v.insumos.funciones || v.insumos.funciones.indexOf(varInsumoName) == -1) && variablesDefinidas.some(v => v.variable == varInsumoName)) {
    //             // let definedVar = variablesDefinidas.filter(v=>v.variable==varInsumoName);
    //             // let varPrefix = (definedVar.clase == 'calculada')? AppVarCal.sufijarCalculada(definedVar.tabla) : definedVar.tabla;
    //             //TODO: HAY QUE prefijar con nombre físico de la td
    //             let varWithPrefix = v.tabla_datos + '.' + varInsumoName;

    //             // Se hacen 3 reemplazos porque no encontramos una regex que sirva para reemplazar de una sola vez todos
    //             // los casos encontrados Y un caso que esté al principio Y un caso que esté al final de la exp validada
    //             let baseRegex = `(${varInsumoName})`;
    //             let noWordRegex = '([^\w\.])';
    //             v.expresionValidada = regexpReplace(noWordRegex, baseRegex, noWordRegex, v.expresionValidada, varWithPrefix); // caso que reemplaza casi todas las ocurrencias en la exp validada
    //             v.expresionValidada = regexpReplace('^()', baseRegex, noWordRegex, v.expresionValidada, varWithPrefix); // caso que reemplaza una posible ocurrencia al principio
    //             v.expresionValidada = regexpReplace(noWordRegex, baseRegex, '()$', v.expresionValidada, varWithPrefix); // caso que reemplaza una posible ocurrencia al final
    //         }
    //     });
    // }

    sentenciaUpdate(margen: number, allVars: Variable[]): string {
        var txtMargen = Array(margen + 1).join(' ');
        
        // se agregan prefijos a todas las variables de cada expresión validada
        if (allVars) {
            this.variablesCalculadas.forEach(v => {
                if (v.insumos) {
                    v.expresionValidada = addAliasesToExpression(v.expresionValidada, v.insumos, allVars, VarCalculator.instanceObj.myTDs)
                }
            });
        }

        return `${txtMargen}UPDATE ${this.tabla.getTableName()}\n${txtMargen}  SET ` +
                this.buildSETClausule(txtMargen) +
                this.buildFROMClausule(txtMargen) + 
                this.buildWHEREClausule(txtMargen);
                
        // let tablesToFromClausule: string[] = [];
        // let completeWhereConditions: string = '';

        // //resultado: se tienen todos los alias de todas las variables (se eliminan duplicados usando Set)
        // let aliasesUsados = [...(new Set([].concat(...(definicion.variables.filter(v => (v.insumos && v.insumos.aliases)).map(v => v.insumos.aliases)))))]; // borrar
        // let aliasesUsados: {[key:string]:Set<string>} = {};

        //     bloqueVars.variables.filter(v => (v.insumos && v.insumos.aliases)).forEach(vac => {
        //         vac.insumos.aliases.forEach(alias => {
        //             if(defEst && defEst.aliases && defEst.aliases[alias]){
        //                 if (! aliasesUsados[alias]){
        //                     aliasesUsados[alias] = new Set();
        //                 }
        //                 vac.insumos.variables.forEach(varName => {
        //                     if (hasAlias(varName) && varName.indexOf(alias) == 0 ) { // si está en la primera posición
        //                         aliasesUsados[alias].add(varName)
        //                     }
        //                 })
        //             }
        //         })
        //     })

        //     let aliasLeftJoins = '';
        //     likear(aliasesUsados).forEach((aliasVars,aliasName) => {
        //         let alias = defEst.aliases[aliasName];
        //         let selectFieldsAlias = defEst.tables[alias.tabla_datos].pks.concat([...aliasVars]).join(', ');
        //         if (alias) {
        //             aliasLeftJoins +=
        // `
        // ${txtMargen}      LEFT JOIN (
        // ${txtMargen}          SELECT ${selectFieldsAlias}
        // ${txtMargen}            FROM ${varCalculator.myTDs.find(alias.tabla_datos).getTableName()} ${aliasName}`;
        //             aliasLeftJoins +=alias.where?
        // `
        // ${txtMargen}            WHERE ${alias.where}`:'';
        //             aliasLeftJoins +=
        // `
        // ${txtMargen}      ) ${aliasName} ON ${alias.on}`; 

        //         }
        //     });

        //     if (tableDefEst && tableDefEst.sourceBro){
        //         tablesToFromClausule.push(tableDefEst.sourceBro + ' ' + tableDefEst.sourceJoin + aliasLeftJoins);
        //     } 
        //     tablesToFromClausule = tablesToFromClausule.concat(defJoinExist ? bloqueVars.joins.map(join => join.tabla) : []);

        //     //saca duplicados de las tablas agregadas y devuelve un arreglo con solo el campo tabla_agregada
        //     let tablasAgregadas = [...(new Set(bloqueVars.variables.filter(v => v.tabla_agregada).map(v => v.tabla_agregada)))];
        //     tablasAgregadas.forEach(tabAgg => {
        //         let vars = bloqueVars.variables.filter(v => v.tabla_agregada == tabAgg);
        //         tablesToFromClausule = tablesToFromClausule.concat(
        //             `
        // ${txtMargen}    LATERAL (
        // ${txtMargen}      SELECT
        // ${txtMargen}          ${vars.map(v => `${getAggregacion(v.funcion_agregacion, v.expresionValidada)} as ${v.variable}`).join(',\n          ' + txtMargen)}
        // ${txtMargen}        FROM ${defEst.tables[tabAgg].sourceAgg} //TODO: poner mas a la izquierda la tabla no calculada para que el join traiga todo
        // ${txtMargen}        WHERE ${defEst.tables[tabAgg].whereAgg[bloqueVars.ua]}
        // ${txtMargen}    ) ${defEst.tables[tabAgg].aliasAgg}`
        //         );
        //     });

        //     return `${txtMargen}UPDATE ${tableDefEst ? tableDefEst.target : bloqueVars.tabla}\n${txtMargen}  SET ` +
        //         bloqueVars.variables.map(function (variable) {
        //             if (variable.tabla_agregada && variable.funcion_agregacion) {
        //                 return `${variable.variable} = ${defEst.tables[variable.tabla_agregada].aliasAgg}.${variable.variable}`;
        //             } else {
        //                 return `${variable.variable} = ${variable.expresionValidada}`;
        //             }
        //         }).join(`,\n      ${txtMargen}`) +
        //         (tablesToFromClausule.length ?
        //             `\n  ${txtMargen}FROM ${tablesToFromClausule.join(', ')}` +
        //             (completeWhereConditions ? `\n  ${txtMargen}WHERE ${completeWhereConditions}` : '')
        //             : '')

    }
    
    buildFROMClausule(txtMargen: string): string {
        return `\n  ${txtMargen}FROM ${tablesToFromClausule.join(', ')}`;
    }

    buildWHEREClausule(txtMargen: string): string {
        return `\n  ${txtMargen}WHERE ${completeWhereConditions}`;
    }

    private buildSETClausule(txtMargen: string) {
        return this.variablesCalculadas.map(v => {
            let expresion = v.expresionValidada
            if (v.tabla_agregada && v.funcion_agregacion) {
                expresion = `${v.tabla_agregada + '_agg'}.${v.variable}`;
            }
            return `${v.variable} = ${expresion}`;
        }).join(`,\n      ${txtMargen}`);
    }
}