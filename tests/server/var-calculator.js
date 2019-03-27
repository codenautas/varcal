"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const expre_parser_1 = require("expre-parser");
const operativos_1 = require("operativos");
const pg_promise_strict_1 = require("pg-promise-strict");
const types_varcal_1 = require("./types-varcal");
const variable_calculada_1 = require("./variable-calculada");
class VarCalculator extends operativos_1.OperativoGenerator {
    constructor(app, client, operativo) {
        super(client, operativo);
        this.app = app;
        this.drops = [];
        this.inserts = [];
        this.bloquesVariablesACalcular = [];
        this.nombreFuncionGeneradora = 'gen_fun_var_calc';
        // acá bajo se concatena _agg
        this.sufijo_agregacion = '_agg';
    }
    async fetchDataFromDB() {
        await super.fetchDataFromDB();
        //converting to type varCalculadas
        this.getVarsCalculadas().forEach(vcalc => Object.setPrototypeOf(vcalc, types_varcal_1.VariableCalculada.prototype));
    }
    getInsumos(expression) {
        return expre_parser_1.parse(expression).getInsumos();
    }
    getWrappedExpression(expression, pkExpression, options) {
        var compiler = new expre_parser_1.Compiler(options);
        return compiler.toCode(expre_parser_1.parse(expression), pkExpression);
    }
    getAggregacion(f, exp) {
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
    getTDFor(v) {
        return this.myTDs.find(td => td.operativo == v.operativo && td.tabla_datos == v.tabla_datos);
    }
    validateAliases(aliases) {
        let validAliases = this.getValidAliases();
        aliases.forEach(alias => {
            if (validAliases.indexOf(alias) == -1) {
                throw new Error('El alias "' + alias + '" no se encontró en la lista de alias válidos: ' + validAliases.join(', '));
            }
        });
    }
    getValidAliases() {
        let validRelationsNames = this.optionalRelations.map(rel => rel.que_busco);
        return this.myTDs.map(td => td.tabla_datos).concat(validRelationsNames);
    }
    validateFunctions(funcNames) {
        let pgWitheList = ['div', 'avg', 'count', 'max', 'min', 'sum', 'coalesce'];
        let comunSquemaWhiteList = ['informado'];
        let functionWhiteList = pgWitheList.concat(comunSquemaWhiteList);
        funcNames.forEach(f => {
            if (operativos_1.hasAlias(f)) {
                if (f.split('.')[0] != 'dbo') {
                    throw new Error('La Función ' + f + ' contiene un alias inválido');
                }
            }
            else {
                if (functionWhiteList.indexOf(f) == -1) {
                    throw new Error('La Función ' + f + ' no está incluida en la whiteList de funciones: ' + functionWhiteList.toString());
                }
            }
        });
    }
    validateInsumos(insumos) {
        this.validateOverwritingNames(insumos);
        this.validateFunctions(insumos.funciones);
        this.validateAliases(insumos.aliases);
        this.validateVars(insumos.variables);
    }
    validateOverwritingNames(insumos) {
        if (insumos.funciones) {
            insumos.variables.forEach(varName => {
                if (insumos.funciones.indexOf(varName) > -1) {
                    throw new Error('La variable "' + varName + '" es también un nombre de función');
                }
            });
        }
    }
    validateVars(varNames) {
        varNames.forEach(vName => { this.validateVar(vName); });
    }
    validateVar(varName) {
        let varsFound = this.findValidVars(varName);
        this.checkFoundVarsForErrors(varsFound, varName);
        return varsFound[0];
    }
    checkFoundVarsForErrors(varsFound, varName) {
        if (varsFound.length > 1) {
            throw new Error('La variable "' + varName + '" se encontró mas de una vez en las siguientes tablas de datos: ' + varsFound.map(v => v.tabla_datos).join(', '));
        }
        if (varsFound.length <= 0) {
            throw new Error('La variable "' + varName + '" no se encontró en la lista de variables.');
        }
        let foundVar = varsFound[0];
        if (!foundVar.activa) {
            throw new Error('La variable "' + varName + '" no está activa.');
        }
    }
    findValidVars(varName) {
        let rawVarName = varName;
        let varsFound = this.myVars;
        if (operativos_1.hasAlias(varName)) {
            let varAlias = varName.split('.')[0];
            rawVarName = varName.split('.')[1];
            let rel = this.getAliasIfOptionalRelation(varName);
            varAlias = rel ? rel.tabla_busqueda : varAlias;
            varsFound = varsFound.filter(v => v.tabla_datos == varAlias);
        }
        return varsFound.filter(v => v.variable == rawVarName);
    }
    getAliasIfOptionalRelation(varName) {
        let rel;
        if (operativos_1.hasAlias(varName)) {
            let varAlias = varName.split('.')[0];
            rel = this.optionalRelations.find(rel => rel.que_busco == varAlias);
        }
        return rel;
    }
    addMainTD(insumosAliases) {
        //aliases involved in this consistence expresion
        if (insumosAliases.indexOf(VarCalculator.mainTD) == -1) {
            insumosAliases.push(VarCalculator.mainTD);
        }
        return insumosAliases;
    }
    prepareEC(ec) {
        this.setInsumos(ec);
        this.validateInsumos(ec.insumos);
        this.filterOrderedTDs(ec); //tabla mas específicas (hija)
    }
    setInsumos(ec) {
        let bn = expre_parser_1.parse(ec.getExpression());
        ec.insumos = bn.getInsumos();
    }
    filterOrderedTDs(ec) {
        //put in constructor
        // TODO: ORDENAR dinamicamente:
        // primero: la td que no tenga ninguna TD en que busco es la principal
        // segundas: van todas las tds que tengan en "que_busco" a la principal
        // terceras: las tds que tengan en "que busco" a las segundas
        // provisoriamente se ordena fijando un arreglo ordenado
        // TODO: deshardcodear main TD
        let insumosAliases = this.addMainTD(ec.insumos.aliases);
        ec.notOrderedInsumosOptionalRelations = this.optionalRelations.filter(r => insumosAliases.indexOf(r.que_busco) > -1);
        let orderedInsumosIngresoTDNames = VarCalculator.orderedIngresoTDNames.filter(orderedTDName => insumosAliases.indexOf(orderedTDName) > -1);
        let orderedInsumosReferencialesTDNames = VarCalculator.orderedReferencialesTDNames.filter(orderedTDName => insumosAliases.indexOf(orderedTDName) > -1);
        ec.orderedInsumosTDNames = orderedInsumosIngresoTDNames.concat(orderedInsumosReferencialesTDNames);
        ec.lastTD = this.getUniqueTD(orderedInsumosIngresoTDNames[orderedInsumosIngresoTDNames.length - 1]);
        ec.firstTD = this.getUniqueTD(VarCalculator.mainTD);
    }
    buildClausulaWhere(ec) {
        let sanitizedExp = this.getWrappedExpression(ec.getExpression(), ec.lastTD.getQuotedPKsCSV(), variable_calculada_1.compilerOptions);
        return this.addAliasesToExpression(sanitizedExp, ec.insumos.variables);
    }
    buildClausulaFrom(ec) {
        let clausula_from = 'FROM ' + pg_promise_strict_1.quoteIdent(ec.firstTD.getTableName());
        for (let i = 1; i < ec.orderedInsumosTDNames.length; i++) {
            let leftInsumoAlias = ec.orderedInsumosTDNames[i - 1];
            let rightInsumoAlias = ec.orderedInsumosTDNames[i];
            clausula_from += this.joinTDs(leftInsumoAlias, rightInsumoAlias);
        }
        //TODO: en el futuro habría que validar que participe del from la tabla de busqueda 
        ec.notOrderedInsumosOptionalRelations.forEach(r => clausula_from += this.joinRelation(r));
        return clausula_from;
    }
    async calculate() {
        this.preCalculate();
        this.parseCalcVarExpressions();
        this.generateDropsAndInserts();
        await this.generateSchemaAndLoadTableDefs();
        this.separarEnGruposOrdenados();
        this.armarFuncionGeneradora();
        return this.getFinalSql();
    }
    preCalculate() {
        this.getVarsCalculadas().forEach(vc => this.prepareEC(vc));
    }
    sentenciaUpdate(margen, bloque) {
        var txtMargen = Array(margen + 1).join(' ');
        return `${txtMargen}UPDATE ${bloque.tabla.getTableName()}\n${txtMargen}  SET ` +
            this.buildSETClausule(txtMargen, bloque) +
            this.buildFROMClausule(txtMargen, bloque) +
            this.buildWHEREClausule(txtMargen, bloque);
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
    buildFROMClausule(txtMargen) {
        return `\n  ${txtMargen}FROM ${tablesToFromClausule.join(', ')}`;
    }
    buildWHEREClausule(txtMargen) {
        return `\n  ${txtMargen}WHERE ${completeWhereConditions}`;
    }
    buildSETClausule(txtMargen) {
        return this.variablesCalculadas.map(v => {
            let expresion = v.expresionValidada;
            if (v.tabla_agregada && v.funcion_agregacion) {
                expresion = `${v.tabla_agregada + '_agg'}.${v.variable}`;
            }
            return `${v.variable} = ${expresion}`;
        }).join(`,\n      ${txtMargen}`);
    }
    addAliasesToExpression(expValidada, insumosVariablesNames) {
        insumosVariablesNames.forEach(varInsumoName => {
            let definedVarForInsumoVar = this.myVars.find(v => v.variable == varInsumoName);
            //TODO: No usar directamente el alias escrito por el usuario sino el getTableName de dicho TD (cuando sea un TD)
            let [varAlias, insumoVarRawName] = operativos_1.hasAlias(varInsumoName) ?
                varInsumoName.split('.') : [definedVarForInsumoVar.tabla_datos, varInsumoName];
            let td = this.myTDs.find(td => td.tabla_datos == varAlias);
            if (td) {
                varAlias = td.getTableName();
            }
            // match all varNames used alone (don't preceded nor followed by "."): 
            // match: p3 ; (23/p3+1); max(13,p3)
            // don't match: alias.p3, p3.column, etc
            let baseRegex = `(?<!\\.)\\b(${varInsumoName})\\b(?!\\.)`;
            let completeVar = pg_promise_strict_1.quoteIdent(varAlias) + '.' + pg_promise_strict_1.quoteIdent(insumoVarRawName);
            expValidada = expValidada.replace(new RegExp(baseRegex, 'g'), completeVar);
        });
        return expValidada;
    }
    separarEnGruposOrdenados() {
        let orderedCalcVars = this.sortCalcVariablesByDependency();
        orderedCalcVars.forEach(function (vCalc) {
            if (this.bloquesVariablesACalcular.length == 0) {
                this.bloquesVariablesACalcular.push(new types_varcal_1.BloqueVariablesCalc(vCalc));
            }
            else {
                var enNivel = vCalc.insumos.variables.length ? vCalc.insumos.variables.map(function (varInsumo) {
                    this.bloquesVariablesACalcular.findIndex(function (nivel) {
                        return nivel.variables.findIndex(function (vvar) {
                            return vvar.variable == varInsumo;
                        }) == -1 ? false : true;
                    });
                }).reduce(function (elem, anterior) {
                    return elem > anterior ? elem : anterior;
                }) : 0;
                if (enNivel >= 0 && this.bloquesVariablesACalcular.length === enNivel + 1) {
                    this.bloquesVariablesACalcular.push(new types_varcal_1.BloqueVariablesCalc(vCalc));
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
                        this.bloquesVariablesACalcular.push(new types_varcal_1.BloqueVariablesCalc(vCalc));
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
        let nonDefinedVars = this.getVarsCalculadas();
        let definedVarsNames = this.getRelevamientoVars().map(v => v.variable);
        var orderedCalcVars = [];
        var prevNonDefVarsLength;
        do {
            prevNonDefVarsLength = nonDefinedVars.length;
            this.findNewDefinedVars(nonDefinedVars, definedVarsNames, orderedCalcVars);
        } while (nonDefinedVars.length > 0 && nonDefinedVars.length != prevNonDefVarsLength);
        if (nonDefinedVars.length > 0) {
            throw new Error("Error, no se pudo determinar el orden de la variable '" + nonDefinedVars[0].variable + "' y otras");
        }
        return orderedCalcVars;
    }
    findNewDefinedVars(nonDefinedVars, definedVars, orderedCalcVars) {
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
    checkInsumos(vCalc, definedVars) {
        var countChecked = 0;
        vCalc.insumos.variables.forEach(varInsumos => countChecked = this.checkAndPushVar(varInsumos, definedVars) ? countChecked + 1 : countChecked);
        // están todas las insumosVars definidas si se cumple la igualdad
        return countChecked == vCalc.insumos.variables.length;
    }
    checkAndPushVar(varInsumosName, definedVars) {
        let varChecked = definedVars.indexOf(varInsumosName) >= 0;
        if (!varChecked && this.isADefinedVarWithValidPrefix(varInsumosName, definedVars)) {
            definedVars.push(varInsumosName);
            varChecked = true;
        }
        // si la variable de insumo estaba definida previamente o porque se acaba de agregar al array 
        return varChecked;
    }
    isADefinedVarWithValidPrefix(varInsumosName, definedVars) {
        // si esta variable tiene un alias && la variable sin alias está definida && el alias existe
        let isDefined = false;
        if (operativos_1.hasAlias(varInsumosName)) {
            let validPrefixes = Object.assign({}, this.myTDs.map(td => td.tabla_datos), this.myRels.filter(r => r.tipo == 'opcional').map(r => r.que_busco));
            var [alias, varName] = varInsumosName.split('.');
            //TODO: mejorar: debería chequear que la variable este definida en la TD correspondiente al alias
            // por ej: si el usuario escribe una expresión "referente.edad" chequear si la variable definida 'edad' además pertenece a la tabla "tabla_busqueda"
            if (definedVars.indexOf(varName) > -1 && (alias in validPrefixes)) {
                isDefined = true;
            }
        }
        return isDefined;
    }
    getTDCalculadas() {
        return this.myTDs.filter(td => td.esCalculada());
    }
    getVarsCalculadas() {
        return this.myVars.filter(v => v.esCalculada());
    }
    getNonCalcVars() {
        return this.myVars.filter(v => !v.esCalculada());
    }
    getRelevamientoVars() {
        return this.getNonCalcVars();
    }
    parseCalcVarExpressions() {
        this.getVarsCalculadas().forEach((v) => {
            v.parseExpression();
            if (v.insumos) {
                v.expresionValidada = this.addAliasesToExpression(v.expresionValidada, v.insumos.variables);
            }
        });
    }
    getFinalSql() {
        let updateFechaCalculada = `
        UPDATE operativos SET calculada=now()::timestamp(0) WHERE operativo=${this.app.db.quoteLiteral(this.operativo)};
        UPDATE tabla_datos SET generada=now()::timestamp(0) WHERE operativo=${this.app.db.quoteLiteral(this.operativo)} AND tipo=${this.app.db.quoteLiteral(operativos_1.tiposTablaDato.calculada)};`;
        this.allSqls = ['do $SQL_DUMP$\n begin', "set search_path = " + this.app.config.db.schema + ';'].concat(this.allSqls).concat(this.funGeneradora, 'perform ' + this.nombreFuncionGeneradora + '();', updateFechaCalculada, 'end\n$SQL_DUMP$');
        // sin funcion generadora
        // this.allSqls = ['do $SQL_DUMP$\n begin', "set search_path = " + this.app.config.db.schema + ';'].concat(this.allSqls).concat(this.funGeneradora, updateFechaCalculada, 'end\n$SQL_DUMP$');
        return this.allSqls.join('\n----\n') + '--- generado: ' + new Date() + '\n';
    }
    async generateSchemaAndLoadTableDefs() {
        let sqls = await this.app.dumpDbSchemaPartial(this.app.generateAndLoadTableDefs(), {});
        this.allSqls = this.drops.concat(sqls.mainSql).concat(sqls.enancePart).concat(this.inserts);
    }
    generateDropsAndInserts() {
        this.getTDCalculadas().forEach(td => {
            this.drops.unshift("drop table if exists " + this.app.db.quoteIdent(td.getTableName()) + ";");
            let insert = `INSERT INTO ${this.app.db.quoteIdent(td.getTableName())} (${td.getQuotedPKsCSV()}) SELECT ${td.getQuotedPKsCSV()} FROM ${this.app.db.quoteIdent(td.que_busco)};`; //estParaGenTabla.sourceJoin + ";");
            this.inserts.push(insert);
        });
    }
    armarFuncionGeneradora() {
        this.funGeneradora = `CREATE OR REPLACE FUNCTION ${this.app.config.db.schema}.${this.nombreFuncionGeneradora}() RETURNS TEXT
          LANGUAGE PLPGSQL
        AS
        $BODY$
        BEGIN
        ` +
            this.bloquesVariablesACalcular.map(bloqueVars => this.sentenciaUpdate(2, bloqueVars) + ';').join('\n') + `
          RETURN 'OK';
        END;
        $BODY$;`;
    }
}
exports.VarCalculator = VarCalculator;
//# sourceMappingURL=var-calculator.js.map