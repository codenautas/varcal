import { Client, OperativoGenerator, tiposTablaDato, hasAlias, TablaDatos, Variable } from "operativos";
import { AppVarCalType } from "./app-varcal";
import { BloqueVariablesCalc, VariableCalculada } from "./types-varcal";
import { Insumos } from "expre-parser";
import { quoteIdent } from "pg-promise-strict";


export class VarCalculator extends OperativoGenerator {

    allSqls: string[]
    drops: string[] = []
    inserts: string[] = []

    bloquesVariablesACalcular: BloqueVariablesCalc[] = [];
    funGeneradora: string;
    nombreFuncionGeneradora: string = 'gen_fun_var_calc'

    constructor(public app: AppVarCalType, client: Client, operativo: string) {
        super(client, operativo);
    }

    async fetchDataFromDB() {
        await super.fetchDataFromDB();
        //converting to type varCalculadas
        this.getVarsCalculadas().forEach(vcalc => Object.setPrototypeOf(vcalc, VariableCalculada.prototype));
    }

    async calculate(): Promise<string> {
        this.generateDropsAndInserts();
        await this.generateSchemaAndLoadTableDefs();
        this.parseCalcVarExpressions();
        this.separarEnGruposOrdenados();
        this.armarFuncionGeneradora();
        return this.getFinalSql();
    }

    addAliasesToExpression(expValidada: string, insumos: Insumos, variablesDefinidas: Variable[], tds: TablaDatos[]) {
        insumos.variables.forEach((varInsumoName: string) => {
            if (!insumos.funciones || insumos.funciones.indexOf(varInsumoName) == -1) {
                let definedVarForInsumoVar = variablesDefinidas.find(v=>v.variable==varInsumoName);
                //TODO: No usar directamente el alias escrito por el usuario sino el getTableName de dicho TD (cuando sea un TD)
                let [varAlias, varInsumoPure] = hasAlias(varInsumoName)? 
                    varInsumoName.split('.'): [definedVarForInsumoVar.tabla_datos, varInsumoName];
                
                let td=tds.find(td=> td.tabla_datos==varAlias);
                if (td){
                    varAlias = td.getTableName();
                }
    
                // match all varNames used alone (don't preceded nor followed by "."): 
                // match: p3 ; (23/p3+1); max(13,p3)
                // don't match: alias.p3, p3.column, etc
                let baseRegex = `(?<!\\.)\\b(${varInsumoName})\\b(?!\\.)`;
                let completeVar = quoteIdent(varAlias) + '.' + quoteIdent(varInsumoPure);
                expValidada = expValidada.replace(new RegExp(baseRegex, 'g'), completeVar);
            }
        });
        return expValidada;
    }

    separarEnGruposOrdenados() {
        let orderedCalcVars: VariableCalculada[] = this.sortCalcVariablesByDependency();

        orderedCalcVars.forEach(function (vCalc: VariableCalculada) {
            if (this.bloquesVariablesACalcular.length == 0) {
                this.bloquesVariablesACalcular.push(new BloqueVariablesCalc(vCalc));
            }
            else {
                var enNivel = vCalc.insumos.variables.length ? vCalc.insumos.variables.map(function (varInsumo) {
                    this.bloquesVariablesACalcular.findIndex(function (nivel) {
                        return nivel.variables.findIndex(function (vvar) {
                            return vvar.variable == varInsumo;
                        }) == -1 ? false : true;
                    });
                }).reduce(function (elem: number, anterior: number) {
                    return elem > anterior ? elem : anterior;
                }) : 0;
                if (enNivel >= 0 && this.bloquesVariablesACalcular.length === enNivel + 1) {
                    this.bloquesVariablesACalcular.push(new BloqueVariablesCalc(vCalc));
                }
                else {
                    let tabla = vCalc.tabla_datos;
                    var nivelTabla = this.bloquesVariablesACalcular[enNivel + 1].tabla == tabla ? enNivel + 1 : this.bloquesVariablesACalcular.findIndex(function (nivel, i) {
                        return nivel.tabla == tabla && i > enNivel + 1;
                    });
                    if (nivelTabla >= 0) {
                        this.bloquesVariablesACalcular[nivelTabla].variables.push(vCalc);
                    }
                    else {
                        this.bloquesVariablesACalcular.push(new BloqueVariablesCalc(vCalc));
                    }
                }
            }
        });
    }

    sortCalcVariablesByDependency() {
        /**
     * @param nonDefinedVars son las que variables a calcular cuyos insumos no están en definedVars
     * @param definedVars variables con insumos definidos
     */
        let nonDefinedVars: VariableCalculada[] = this.getVarsCalculadas();
        let definedVarsNames: string[] = this.getRelevamientoVars().map(v => v.variable);

        var orderedCalcVars: VariableCalculada[] = [];
        var prevNonDefVarsLength: number;
        do {
            prevNonDefVarsLength = nonDefinedVars.length;
            this.findNewDefinedVars(nonDefinedVars, definedVarsNames, orderedCalcVars);
        } while (nonDefinedVars.length > 0 && nonDefinedVars.length != prevNonDefVarsLength);
        if (nonDefinedVars.length > 0) {
            throw new Error("Error, no se pudo determinar el orden de la variable '" + nonDefinedVars[0].variable + "' y otras");
        }
        return orderedCalcVars;
    }

    private findNewDefinedVars(nonDefinedVars: VariableCalculada[], definedVars: string[], orderedCalcVars: VariableCalculada[]) {
        var i = 0;
        //TODO: Manejar las variables con el mismo nombre (para distintas TDs)
        while (i < nonDefinedVars.length) {
            let vCalc = nonDefinedVars[i];
            // si todas las variables de insumo de una varCalc están definidas,
            if (this.checkInsumos(vCalc, definedVars)) {
                // entonces se agrega la variable en cuestión como definida y se elimina de la lista de no definidas
                definedVars.push(vCalc.variable);
                orderedCalcVars.push(vCalc);
                nonDefinedVars.splice(i, 1);
            }
            else {
                i++;
            }
        }
    }

    checkInsumos(vCalc: VariableCalculada, definedVars: string[]): boolean {
        var countChecked: number = 0;
        vCalc.insumos.variables.forEach(
            varInsumos => countChecked = this.checkAndPushVar(varInsumos, definedVars) ? countChecked + 1 : countChecked);
        // están todas las insumosVars definidas si se cumple la igualdad
        return countChecked == vCalc.insumos.variables.length;
    }

    private checkAndPushVar(varInsumosName: string, definedVars: string[]) {
        let varChecked = definedVars.indexOf(varInsumosName) >= 0;
        if (!varChecked && this.isADefinedVarWithValidPrefix(varInsumosName, definedVars)) {
            definedVars.push(varInsumosName);
            varChecked = true;
        }
        // si la variable de insumo estaba definida previamente o porque se acaba de agregar al array 
        return varChecked;
    }

    private isADefinedVarWithValidPrefix(varInsumosName: string, definedVars: string[]) {
        // si esta variable tiene un alias && la variable sin alias está definida && el alias existe
        let isDefined = false;
        if (hasAlias(varInsumosName)) {
            let validPrefixes = { ...this.myTDs.map(td => td.tabla_datos), ...this.myRels.filter(r => r.tipo == 'opcional').map(r => r.que_busco) };
            var [alias, varName] = varInsumosName.split('.')
            //TODO: mejorar: debería chequear que la variable este definida en la TD correspondiente al alias
            // por ej: si el usuario escribe una expresión "referente.edad" chequear si la variable definida 'edad' además pertenece a la tabla "tabla_busqueda"
            if (definedVars.indexOf(varName) > -1 && (alias in validPrefixes)) {
                isDefined = true
            }
        }
        return isDefined;
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

    getRelevamientoVars() {
        return this.getNonCalcVars();
    }

    parseCalcVarExpressions() {
        this.getVarsCalculadas().forEach((v: VariableCalculada) => v.parseExpression());
    }

    getFinalSql(): string {
        let updateFechaCalculada = `
        UPDATE operativos SET calculada=now()::timestamp(0) WHERE operativo=${this.app.db.quoteLiteral(this.operativo)};
        UPDATE tabla_datos SET generada=now()::timestamp(0) WHERE operativo=${this.app.db.quoteLiteral(this.operativo)} AND tipo=${this.app.db.quoteLiteral(tiposTablaDato.calculada)};`;

        this.allSqls = ['do $SQL_DUMP$\n begin', "set search_path = " + this.app.config.db.schema + ';'].concat(this.allSqls).concat(this.funGeneradora, 'perform ' + this.nombreFuncionGeneradora + '();', updateFechaCalculada, 'end\n$SQL_DUMP$');
        // sin funcion generadora
        // this.allSqls = ['do $SQL_DUMP$\n begin', "set search_path = " + this.app.config.db.schema + ';'].concat(this.allSqls).concat(this.funGeneradora, updateFechaCalculada, 'end\n$SQL_DUMP$');
        return this.allSqls.join('\n----\n') + '--- generado: ' + new Date() + '\n';
    }

    async generateSchemaAndLoadTableDefs() {
        let sqls = await this.app.dumpDbSchemaPartial(this.app.generateAndLoadTableDefs(), {});
        this.allSqls = this.drops.concat(sqls.mainSql).concat(sqls.enancePart).concat(this.inserts)
    }

    generateDropsAndInserts() {
        this.getTDCalculadas().forEach(td => {
            this.drops.unshift("drop table if exists " + this.app.db.quoteIdent(td.getTableName()) + ";");
            let insert = `INSERT INTO ${this.app.db.quoteIdent(td.getTableName())} (${td.getQuotedPKsCSV()}) SELECT ${td.getQuotedPKsCSV()} FROM ${this.app.db.quoteIdent(td.que_busco)};` //estParaGenTabla.sourceJoin + ";");
            this.inserts.push(insert);
        })
    }

    armarFuncionGeneradora(): any {
        this.funGeneradora = `CREATE OR REPLACE FUNCTION ${this.app.config.db.schema}.${this.nombreFuncionGeneradora}() RETURNS TEXT
          LANGUAGE PLPGSQL
        AS
        $BODY$
        BEGIN
        `+
            this.bloquesVariablesACalcular.map(bloqueVars => bloqueVars.sentenciaUpdate(2, this.myVars) + ';').join('\n') + `
          RETURN 'OK';
        END;
        $BODY$;`;
    }

    // checkInsumos(vcalc: VariableCalculada, definicionesOrd: Variable[], nonDefinedVars: Variable[]): boolean {
    //     let definedVars = this.getVarsDefinidas();
    //     var cantDef: number = 0;
    //     vcalc.insumos.variables.forEach(function (insumosVar) {
    //         // si esta variable de insumo tiene un prefijo 
    //         if (hasAlias(insumosVar)) {
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
    //         if (hasAlias(varInsumos) && defEst) {
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