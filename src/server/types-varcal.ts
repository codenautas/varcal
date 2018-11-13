import { CompilerOptions, Insumos } from 'expre-parser';
import { OperativoGenerator, tiposTablaDato, Variable, VariableOpcion, VariableDB, AppOperativos } from 'operativos';
import { AppVarCalType } from "./app-varcal";
import { getInsumos, getWrappedExpression } from './var-cal';
import { Client } from 'pg-promise-strict';

// re-exports
export { CompilerOptions, Insumos } from 'expre-parser';
export * from 'operativos';

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
        let tdPks = VarCalculator.instanceObj.getTDFor(this).getPKCSV();
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

export let compilerOptions: CompilerOptions = { language: 'sql', varWrapper: 'null2zero', divWrapper: 'div0err', elseWrapper: 'lanzar_error' };

export class VarCalculator extends OperativoGenerator {
    allSqls: string[]
    drops: string[] = []
    inserts: string[] = []

    bloquesVariablesACalcular: BloqueVariablesCalc[]
    funGeneradora: string

    constructor(public app: AppVarCalType, operativo: string) {
        super(operativo);
    }

    async fetchDataFromDB(client: Client) {
        await super.fetchDataFromDB(client);
        //converting to type varCalculadas
        this.getVarsCalculadas().forEach(vcalc => Object.setPrototypeOf(vcalc, VariableCalculada.prototype));
    }

    getTDCalculadas() {
        return this.myTDs.filter(td => td.esCalculada());
    }

    getVarsCalculadas(): VariableCalculada[] {
        return <VariableCalculada[]>this.myVars.filter(v => v.esCalculada())
    }

    getNonCalcVars() {
        return this.myVars.filter(v => !v.esCalculada());
    }

    parseCalcVarExpressions() {
        this.getVarsCalculadas().forEach((v: VariableCalculada) => v.parseExpression());
    }

    getFinalSql(): string {
        let updateFechaCalculada = `
        UPDATE operativos SET calculada=now()::timestamp(0) WHERE operativo='${this.operativo}';
        UPDATE tabla_datos SET generada=now()::timestamp(0) WHERE operativo='${this.operativo}' AND tipo='${tiposTablaDato.calculada}';`;

        // this.allSqls = ['do $SQL_DUMP$\n begin', "set search_path = " + this.app.config.db.schema + ';'].concat(this.allSqls).concat(this.funGeneradora, 'perform gen_fun_var_calc();', updateFechaCalculada,  'end\n$SQL_DUMP$');
        // sin funcion generadora
        this.allSqls = ['do $SQL_DUMP$\n begin', "set search_path = " + this.app.config.db.schema + ';'].concat(this.allSqls).concat(this.funGeneradora, updateFechaCalculada, 'end\n$SQL_DUMP$');
        return this.allSqls.join('\n----\n') + '--- generado: ' + new Date() + '\n';
    }

    async generateSchemaAndLoadTableDefs() {
        let sqls = await this.app.dumpDbSchemaPartial(this.app.generateAndLoadTableDefs(), {});
        this.allSqls = this.drops.concat(sqls.mainSql).concat(sqls.enancePart).concat(this.inserts)
    }

    generateDropsAndInserts() {
        this.getTDCalculadas().forEach(td => {
            this.drops.unshift("drop table if exists " + this.app.db.quoteIdent(td.getTableName()) + ";");
            let insert = `INSERT INTO ${this.app.db.quoteIdent(td.getTableName())} (${td.getPKCSV()}) SELECT ${td.getPKCSV()} FROM ${td.getPrefixedQueBusco()};` //estParaGenTabla.sourceJoin + ";");
            this.inserts.push(insert);
        })
    }

    armarFuncionGeneradora(): any {
        var parametros = {
            nombreFuncionGeneradora: 'gen_fun_var_calc',
            esquema: this.app.config.db.schema,
        };

        this.funGeneradora = `CREATE OR REPLACE FUNCTION ${parametros.esquema}.${parametros.nombreFuncionGeneradora}() RETURNS TEXT
          LANGUAGE PLPGSQL
        AS
        $BODY$
        BEGIN
        `+
            this.bloquesVariablesACalcular.map(bloqueVars => bloqueVars.sentenciaUpdate(2, this.getNonCalcVars()) + ';').join('\n') + `
          RETURN 'OK';
        END;
        $BODY$;`;
    }

    // checkInsumos(vcalc: VariableCalculada, definicionesOrd: Variable[], nonDefinedVars: Variable[]): boolean {
    //     let definedVars = this.getVarsDefinidas();
    //     var cantDef: number = 0;
    //     vcalc.insumos.variables.forEach(function (insumosVar) {
    //         // si esta variable de insumo tiene un prefijo 
    //         if (Variable.hasTablePrefix(insumosVar)) {
    //             var [prefix, varName] = insumosVar.split('.');
    //             // si la variable sin prefijo está definida && el prefijo está en la tabla de aliases
    //             if (definedVars.some(v => v.tabla_datos == prefix && v.variable == varName)) {
    //                 definedVars.push(insumosVar);// then agrego esta variable a definedVars
    //             }
    //         }
    //         cantDef = definedVars.indexOf(insumosVar) >= 0 ? cantDef + 1 : cantDef;
    //     });
    //     if (cantDef == insumos.variables.length) {
    //         definedVars.push(variable);
    //         definicionesOrd.push(vcalc);
    //         if (nonDefinedVars.indexOf(vcalc) >= 0) {
    //             nonDefinedVars.splice(nonDefinedVars.indexOf(vcalc), 1)
    //         }
    //     }
    //     return cantDef == insumos.variables.length;
    // }

    // function checkInsumos(defVariable: VariableGenerable, vardef: string[], definicionesOrd: VariableGenerable[], nvardef: VariableGenerable[], defEst: DefinicionEstructural): boolean {
    //     var { nombreVariable, insumos } = defVariable;
    //     var cantDef: number = 0;
    //     insumos.variables.forEach(function (varInsumos) {
    //         // si esta variable tiene un prefijo && la variable sin prefijo está definida && el prefijo está en la tabla de aliases
    //         if (hasTablePrefix(varInsumos) && defEst) {
    //             var [prefix, varName] = varInsumos.split('.');
    //             if (vardef.indexOf(varName) > -1 && (prefix in { ...defEst.tables, ...defEst.aliases })) {
    //                 vardef.push(varInsumos);// then agrego esta variable a vardef
    //             }
    //         }
    //         cantDef = vardef.indexOf(varInsumos) >= 0 ? cantDef + 1 : cantDef;
    //     });
    //     if (cantDef == insumos.variables.length) {
    //         vardef.push(nombreVariable);
    //         definicionesOrd.push(defVariable);
    //         if (nvardef.indexOf(defVariable) >= 0) {
    //             nvardef.splice(nvardef.indexOf(defVariable), 1)
    //         }
    //     }
    //     return cantDef == insumos.variables.length;
    // }


    // /**
    //  * @param nvardef son las que variables a calcular cuyos insumos no están en vardef
    //  * @param variablesDefinidas variables con insumos definidos
    //  */
    // function separarEnGruposPorNivelYOrigen(nvardef: VariableGenerable[], variablesDefinidas: string[], defEst?: DefinicionEstructural): BloqueVariablesGenerables[] {
    //     var listaOut: BloqueVariablesGenerables[] = [];
    //     var lenAnt: number;
    //     var definicionesOrd: VariableGenerable[] = [];
    //     var compararJoins = function (joins1: Join[], joins2: Join[]) {
    //         return (joins1 === undefined && joins2 === undefined ||
    //             JSON.stringify(joins1) === JSON.stringify(joins2)) ? true : false;
    //     };
    //     var nuevoBloqueListaOut = function (defVariable: VariableGenerable): BloqueVariablesGenerables {
    //         var { joins, ...varAnalizada } = defVariable;
    //         var nuevo: BloqueVariablesGenerables = { tabla: defVariable.tabla, variables: [varAnalizada], ua: defVariable.ua };
    //         if (joins !== undefined) {
    //             nuevo.joins = joins;
    //         }
    //         return nuevo;
    //     };
    //     do {
    //         lenAnt = nvardef.length;
    //         var i = 0;
    //         while (i < nvardef.length) {
    //             if (!checkInsumos(nvardef[i], variablesDefinidas, definicionesOrd, nvardef, defEst)) {
    //                 i++;
    //             }
    //         };
    //     } while (nvardef.length > 0 && nvardef.length != lenAnt);
    //     if (nvardef.length > 0) {
    //         throw new Error("Error, no se pudo determinar el orden de la variable '" + nvardef[0].nombreVariable + "' y otras")
    //     }
    //     definicionesOrd.forEach(function (defVariable: VariableGenerable) {
    //         var { joins, ...varAnalizada } = defVariable;
    //         let tabla = defVariable.tabla;
    //         if (listaOut.length == 0) {
    //             listaOut.push(nuevoBloqueListaOut(defVariable));
    //         } else {
    //             var enNivel = defVariable.insumos.variables.length ? defVariable.insumos.variables.map(function (varInsumo) {
    //                 return listaOut.findIndex(function (nivel) {
    //                     return nivel.variables.findIndex(function (vvar) {
    //                         return vvar.nombreVariable == varInsumo
    //                     }) == -1 ? false : true
    //                 })
    //             }).reduce(function (elem: number, anterior: number) {
    //                 return elem > anterior ? elem : anterior;
    //             }) : 0;
    //             if (enNivel >= 0 && listaOut.length === enNivel + 1) {
    //                 listaOut.push(nuevoBloqueListaOut(defVariable));
    //             } else {
    //                 var nivelTabla = listaOut[enNivel + 1].tabla == tabla && compararJoins(listaOut[enNivel + 1].joins, joins) ? enNivel + 1 : listaOut.findIndex(function (nivel, i) {
    //                     return nivel.tabla == tabla && compararJoins(nivel.joins, joins) && i > enNivel + 1
    //                 });
    //                 if (nivelTabla >= 0) {
    //                     listaOut[nivelTabla].variables.push(varAnalizada);
    //                 } else {
    //                     listaOut.push(nuevoBloqueListaOut(defVariable));
    //                 }
    //             }
    //         }
    //     });
    //     //console.log(JSON.stringify(listaOut));
    //     return listaOut;
    // }

    // separarEnGruposPorNivelYOrigen() {
    //     let varsCalc = this.getVarsCalculadas();
    //     var listaOut: BloqueVariablesCalc[] = [];
    //     var lenAnt: number;
    //     var definicionesOrd: Variable[] = [];
    //     // var compararJoins = function (joins1: Join[], joins2: Join[]) {
    //     //     return (joins1 === undefined && joins2 === undefined ||
    //     //         JSON.stringify(joins1) === JSON.stringify(joins2)) ? true : false;
    //     // };
    //     var nuevoBloqueListaOut = function (defVariable: VariableCalculada): BloqueVariablesCalc {
    //         return new BloqueVariablesCalc(defVariable.tabla_datos, [defVariable]);
    //     };
    //     do {
    //         lenAnt = varsCalc.length;
    //         var i = 0;
    //         while (i < varsCalc.length) {
    //             if (!this.checkInsumos(varsCalc[i], definicionesOrd, varsCalc)) {
    //                 i++;
    //             }
    //         };
    //     } while (varsCalc.length > 0 && varsCalc.length != lenAnt);
    //     if (varsCalc.length > 0) {
    //         throw new Error("Error, no se pudo determinar el orden de la variable '" + varsCalc[0].variable + "' y otras")
    //     }
    //     definicionesOrd.forEach(function (varAnalizada: VariableCalculada) {
    //         // let tabla = varAnalizada.tabla_datos;
    //         if (listaOut.length == 0) {
    //             listaOut.push(nuevoBloqueListaOut(varAnalizada));
    //         } else {
    //             var enNivel = varAnalizada.insumos.variables.length ? varAnalizada.insumos.variables.map(function (varInsumo) {
    //                 return listaOut.findIndex(function (nivel) {
    //                     return nivel.variables.findIndex(function (vvar) {
    //                         return vvar.variable == varInsumo
    //                     }) == -1 ? false : true
    //                 })
    //             }).reduce(function (elem: number, anterior: number) {
    //                 return elem > anterior ? elem : anterior;
    //             }) : 0;
    //             if (enNivel >= 0 && listaOut.length === enNivel + 1) {
    //                 listaOut.push(nuevoBloqueListaOut(varAnalizada));
    //             } else {
    //                 // var nivelTabla = listaOut[enNivel + 1].tabla == tabla && compararJoins(listaOut[enNivel + 1].joins, joins) ? enNivel + 1 : listaOut.findIndex(function (nivel, i) {
    //                 //     return nivel.tabla == tabla && compararJoins(nivel.joins, joins) && i > enNivel + 1
    //                 // });
    //                 // if (nivelTabla >= 0) {
    //                 //     listaOut[nivelTabla].variables.push(varAnalizada);
    //                 // } else {
    //                 //     listaOut.push(nuevoBloqueListaOut(varAnalizada));
    //                 // }
    //             }
    //         }
    //     });
    //     //console.log(JSON.stringify(listaOut));
    //     this.bloquesVariablesACalcular = listaOut;
    //     //separarEnGruposPorNivelYOrigen(variablesACalcular, variablesDefinidas.map(v => v.variable))
    // }
}

export type ParametrosGeneracion = {
    nombreFuncionGeneradora: string,
    esquema: string
}

// construye una sola regex con 3 partes (grupos de captura) de regex diferentes, y hace el reemplazo que se pide por parametro
export function regexpReplace(guno: string, gdos: string, gtres: string, sourceStr: string, replaceStr: string) {
    let completeRegex = guno + gdos + gtres;
    return sourceStr.replace(new RegExp(completeRegex, 'g'), '$1' + replaceStr + '$3');
}

//TODO: UNIFICAR ahora está copiado y casi igual al de varcal
export function prefijarExpresion(expValidada: string, insumos: Insumos, variablesDefinidas: Variable[]) {
    insumos.variables.forEach((varInsumoName: string) => {
        if (!insumos.funciones || insumos.funciones.indexOf(varInsumoName) == -1) {
            let definedVarForInsumoVar = variablesDefinidas.find(v=>v.variable==varInsumoName);
            //TODO si es una tabla interna no se debería prefijar con operativo
            let [varPrefix, varInsumoPure] = Variable.hasTablePrefix(varInsumoName)? 
                varInsumoName.split('.'): [definedVarForInsumoVar.tabla_datos, varInsumoName];
            let completeVar = AppOperativos.prefixTableName(varPrefix, definedVarForInsumoVar.operativo) + '.' + varInsumoPure;
                
            // Se hacen 3 reemplazos porque no encontramos una regex que sirva para reemplazar de una sola vez todos
            // los casos encontrados Y un caso que esté al principio Y un caso que esté al final de la exp validada
            let baseRegex = `(${varInsumoName})`;
            let noWordRegex = '([^\w\.])';
            expValidada = regexpReplace(noWordRegex, baseRegex, noWordRegex, expValidada, completeVar); // caso que reemplaza casi todas las ocurrencias en la exp validada
            expValidada = regexpReplace('^()', baseRegex, noWordRegex, expValidada, completeVar); // caso que reemplaza una posible ocurrencia al principio
            expValidada = regexpReplace(noWordRegex, baseRegex, '()$', expValidada, completeVar); // caso que reemplaza una posible ocurrencia al final
        }
    });
}

export class BloqueVariablesCalc {

    constructor(public tabla: string, public variables: VariableCalculada[]) {
    }

    // //TODO: UNIFICAR ahora está copiado y casi igual al de consistencias
    // prefijarExpresionnn(v: VariableCalculada, variablesDefinidas: Variable[]) {
    //     v.insumos.variables.forEach((varInsumoName: string) => {
    //         if (!Variable.hasTablePrefix(varInsumoName) && (!v.insumos.funciones || v.insumos.funciones.indexOf(varInsumoName) == -1) && variablesDefinidas.some(v => v.variable == varInsumoName)) {
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

    sentenciaUpdate(margen: number, variablesDefinidas: Variable[]): string {
        // let tablesToFromClausule: string[] = [];
        // let completeWhereConditions: string = '';
        // var txtMargen = Array(margen + 1).join(' ');

        // se agregan prefijos a todas las variables de cada expresión validada
        if (variablesDefinidas) {
            this.variables.forEach(v => {
                if (v.insumos) {
                    prefijarExpresion(v.expresionValidada, v.insumos, variablesDefinidas)
                }
            });
        }

        // resultado: se tienen todos los alias de todas las variables (se eliminan duplicados usando Set)
        //let aliasesUsados = [...(new Set([].concat(...(definicion.variables.filter(v => (v.insumos && v.insumos.aliases)).map(v => v.insumos.aliases)))))]; // borrar
        // let aliasesUsados: {[key:string]:Set<string>} = {};

        //     bloqueVars.variables.filter(v => (v.insumos && v.insumos.aliases)).forEach(vac => {
        //         vac.insumos.aliases.forEach(alias => {
        //             if(defEst && defEst.aliases && defEst.aliases[alias]){
        //                 if (! aliasesUsados[alias]){
        //                     aliasesUsados[alias] = new Set();
        //                 }
        //                 vac.insumos.variables.forEach(varName => {
        //                     if (Variable.hasTablePrefix(varName) && varName.indexOf(alias) == 0 ) { // si está en la primera posición
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
        // ${txtMargen}            FROM ${tableDefEst.operativo.toLowerCase() + '_' + alias.tabla_datos} ${aliasName}`;
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
        // ${txtMargen}        FROM ${defEst.tables[tabAgg].sourceAgg}
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


        return margen + '';

    }

};