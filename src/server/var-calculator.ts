import { Insumos, parse, Compiler, CompilerOptions, BaseNode } from "expre-parser";
import { Client, hasAlias, OperativoGenerator, Relacion, tiposTablaDato, Variable } from "operativos";
import { quoteIdent } from "pg-promise-strict";
import { AppVarCalType } from "./app-varcal";
import { ExpressionContainer } from "./expression-container";
import { BloqueVariablesCalc, VariableCalculada } from "./types-varcal";
import { compilerOptions } from "./variable-calculada";


export class VarCalculator extends OperativoGenerator {

    private allSqls: string[]
    private drops: string[] = []
    private inserts: string[] = []

    private bloquesVariablesACalcular: BloqueVariablesCalc[] = [];
    private funGeneradora: string;
    private nombreFuncionGeneradora: string = 'gen_fun_var_calc'

    constructor(public app: AppVarCalType, client: Client, operativo: string) {
        super(client, operativo);
    }

    async fetchDataFromDB() {
        await super.fetchDataFromDB();
        //converting to type varCalculadas
        this.getVarsCalculadas().forEach(vcalc => Object.setPrototypeOf(vcalc, VariableCalculada.prototype));
        
    }

    getInsumos(expression: string): Insumos {
        return parse(expression).getInsumos();
    }

    getWrappedExpression(expression: string | number, pkExpression: string, options: CompilerOptions): string {
        var compiler = new Compiler(options);
        return compiler.toCode(parse(expression), pkExpression);
    }

    getAggregacion(f: string, exp: string) {
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

    getTDFor(v:VariableCalculada){
        return this.myTDs.find(td => td.operativo == v.operativo && td.tabla_datos == v.tabla_datos);
    }

    protected optionalRelations: Relacion[];
    
    private validateAliases(aliases: string[]): any {
        let validAliases=this.getValidAliases();
        aliases.forEach(alias=>{
            if (validAliases.indexOf(alias) == -1) {
                throw new Error('El alias "' + alias + '" no se encontró en la lista de alias válidos: ' + validAliases.join(', '));
            }
        });
    }
    private getValidAliases(): string[]{
        let validRelationsNames = this.optionalRelations.map(rel=>rel.que_busco)
        return this.myTDs.map(td=>td.tabla_datos).concat(validRelationsNames);
    }
    private validateFunctions(funcNames: string[]) {
        let pgWitheList = ['div', 'avg', 'count', 'max', 'min', 'sum', 'coalesce'];
        let comunSquemaWhiteList = ['informado'];
        let functionWhiteList = pgWitheList.concat(comunSquemaWhiteList);
        funcNames.forEach(f => {
            if (hasAlias(f)) {
                if (f.split('.')[0] != 'dbo') {
                    throw new Error('La Función ' + f + ' contiene un alias inválido');
                }
            } else {
                if (functionWhiteList.indexOf(f) == -1) {
                    throw new Error('La Función ' + f + ' no está incluida en la whiteList de funciones: ' + functionWhiteList.toString());
                }
            }
        })
    }

    private validateInsumos(insumos:Insumos): void {
        this.validateOverwritingNames(insumos);
        this.validateFunctions(insumos.funciones);
        this.validateAliases(insumos.aliases);
        this.validateVars(insumos.variables)
    }

    private validateOverwritingNames(insumos: Insumos): void {
        if (insumos.funciones){
            insumos.variables.forEach(varName=> {
                if(insumos.funciones.indexOf(varName) > -1) {
                    throw new Error('La variable "' + varName + '" es también un nombre de función');
                }
            })
        }
    }

    private validateVars(varNames: string[]): void {
        varNames.forEach(vName => {this.validateVar(vName)})
    }

    protected validateVar(varName: string): Variable {
        let varsFound:Variable[] = this.findValidVars(varName);
        this.checkFoundVarsForErrors(varsFound, varName);
        return varsFound[0];
    }
    
    private checkFoundVarsForErrors(varsFound: Variable[], varName: string) {
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

    private findValidVars(varName: string) {
        let rawVarName = varName;
        let varsFound:Variable[] = this.myVars;
        if (hasAlias(varName)) {
            let varAlias = varName.split('.')[0];
            rawVarName = varName.split('.')[1];
           
            let rel = this.getAliasIfOptionalRelation(varName);
            varAlias = rel? rel.tabla_busqueda: varAlias

            varsFound = varsFound.filter(v => v.tabla_datos == varAlias);
        }
        return varsFound.filter(v => v.variable == rawVarName);
    }

    protected getAliasIfOptionalRelation(varName:string):Relacion{
        let rel:Relacion
        if (hasAlias(varName)){
            let varAlias = varName.split('.')[0];
            rel = this.optionalRelations.find(rel => rel.que_busco == varAlias)
        }
        return rel
    }

    private addMainTD(insumosAliases: string[]) {
        //aliases involved in this consistence expresion
        if (insumosAliases.indexOf(VarCalculator.mainTD) == -1) {
            insumosAliases.push(VarCalculator.mainTD);
        }
        return insumosAliases;
    }

    protected prepareEC(ec: ExpressionContainer): any {
        this.setInsumos(ec)
        this.validateInsumos(ec.insumos);
        this.filterOrderedTDs(ec); //tabla mas específicas (hija)
    }

    private setInsumos(ec:ExpressionContainer){
        let bn:BaseNode = parse(ec.getExpression()); 
        ec.insumos = bn.getInsumos();
    }
    
    protected filterOrderedTDs(ec:ExpressionContainer) {
        //put in constructor
        // TODO: ORDENAR dinamicamente:
        // primero: la td que no tenga ninguna TD en que busco es la principal
        // segundas: van todas las tds que tengan en "que_busco" a la principal
        // terceras: las tds que tengan en "que busco" a las segundas
        // provisoriamente se ordena fijando un arreglo ordenado
        // TODO: deshardcodear main TD
        
        let insumosAliases = this.addMainTD(ec.insumos.aliases);
        ec.notOrderedInsumosOptionalRelations = this.optionalRelations.filter(r => insumosAliases.indexOf(r.que_busco) > -1);
        let orderedInsumosIngresoTDNames:string[] = VarCalculator.orderedIngresoTDNames.filter(orderedTDName => insumosAliases.indexOf(orderedTDName) > -1);
        let orderedInsumosReferencialesTDNames:string[]= VarCalculator.orderedReferencialesTDNames.filter(orderedTDName => insumosAliases.indexOf(orderedTDName) > -1);
        ec.orderedInsumosTDNames = orderedInsumosIngresoTDNames.concat(orderedInsumosReferencialesTDNames);
        ec.lastTD = this.getUniqueTD(orderedInsumosIngresoTDNames[orderedInsumosIngresoTDNames.length - 1]);
        ec.firstTD = this.getUniqueTD(VarCalculator.mainTD);
    }

    protected buildClausulaWhere(ec:ExpressionContainer):string {
        let sanitizedExp = this.getWrappedExpression(ec.getExpression(), ec.lastTD.getQuotedPKsCSV(), compilerOptions);
        return this.addAliasesToExpression(sanitizedExp, ec.insumos.variables);
    }
    
    protected buildClausulaFrom(ec:ExpressionContainer): string {
        let clausula_from = 'FROM ' + quoteIdent(ec.firstTD.getTableName());
        for (let i = 1; i < ec.orderedInsumosTDNames.length; i++) {
            let leftInsumoAlias = ec.orderedInsumosTDNames[i - 1];
            let rightInsumoAlias = ec.orderedInsumosTDNames[i];
            clausula_from += this.joinTDs(leftInsumoAlias, rightInsumoAlias);
        }
        //TODO: en el futuro habría que validar que participe del from la tabla de busqueda 
        ec.notOrderedInsumosOptionalRelations.forEach(r=>clausula_from += this.joinRelation(r));
        return clausula_from;
    }

    async calculate(): Promise<string> {
        
        this.preCalculate()        
        
        this.parseCalcVarExpressions();

        this.generateDropsAndInserts();
        await this.generateSchemaAndLoadTableDefs();
        this.separarEnGruposOrdenados();
        this.armarFuncionGeneradora();
        return this.getFinalSql();
    }
    private preCalculate(): any {
        this.getVarsCalculadas().forEach(vc=>this.prepareEC(vc));
    }

    private sentenciaUpdate(margen: number, bloque: BloqueVariablesCalc): string {
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
    
    buildFROMClausule(txtMargen: string): string {
        return `\n  ${txtMargen}FROM ${tablesToFromClausule.join(', ')}`;
    }

    buildWHEREClausule(txtMargen: string): string {
        return `\n  ${txtMargen}WHERE ${completeWhereConditions}`;
    }

    // acá bajo se concatena _agg
    export const sufijo_agregacion: string = '_agg';

    private buildSETClausule(txtMargen: string) {
        return this.variablesCalculadas.map(v => {
            let expresion = v.expresionValidada
            if (v.tabla_agregada && v.funcion_agregacion) {
                expresion = `${v.tabla_agregada + '_agg'}.${v.variable}`;
            }
            return `${v.variable} = ${expresion}`;
        }).join(`,\n      ${txtMargen}`);
    }

    private addAliasesToExpression(expValidada: string, insumosVariablesNames: string[]) {
        insumosVariablesNames.forEach(varInsumoName => {
            let definedVarForInsumoVar = this.myVars.find(v=>v.variable==varInsumoName);
            //TODO: No usar directamente el alias escrito por el usuario sino el getTableName de dicho TD (cuando sea un TD)
            let [varAlias, insumoVarRawName] = hasAlias(varInsumoName)? 
                varInsumoName.split('.'): [definedVarForInsumoVar.tabla_datos, varInsumoName];
            
            let td=this.myTDs.find(td=> td.tabla_datos==varAlias);
            if (td){
                varAlias = td.getTableName();
            }

            // match all varNames used alone (don't preceded nor followed by "."): 
            // match: p3 ; (23/p3+1); max(13,p3)
            // don't match: alias.p3, p3.column, etc
            let baseRegex = `(?<!\\.)\\b(${varInsumoName})\\b(?!\\.)`;
            let completeVar = quoteIdent(varAlias) + '.' + quoteIdent(insumoVarRawName);
            expValidada = expValidada.replace(new RegExp(baseRegex, 'g'), completeVar);
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

    private sortCalcVariablesByDependency() {
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

    private checkInsumos(vCalc: VariableCalculada, definedVars: string[]): boolean {
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
        this.getVarsCalculadas().forEach((v: VariableCalculada) => 
        {
            v.parseExpression()
            if (v.insumos) {
                v.expresionValidada = this.addAliasesToExpression(v.expresionValidada, v.insumos.variables)
            }
        });
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

    private generateDropsAndInserts() {
        this.getTDCalculadas().forEach(td => {
            this.drops.unshift("drop table if exists " + this.app.db.quoteIdent(td.getTableName()) + ";");
            let insert = `INSERT INTO ${this.app.db.quoteIdent(td.getTableName())} (${td.getQuotedPKsCSV()}) SELECT ${td.getQuotedPKsCSV()} FROM ${this.app.db.quoteIdent(td.que_busco)};` //estParaGenTabla.sourceJoin + ";");
            this.inserts.push(insert);
        })
    }

    private armarFuncionGeneradora(): any {
        this.funGeneradora = `CREATE OR REPLACE FUNCTION ${this.app.config.db.schema}.${this.nombreFuncionGeneradora}() RETURNS TEXT
          LANGUAGE PLPGSQL
        AS
        $BODY$
        BEGIN
        `+
            this.bloquesVariablesACalcular.map(bloqueVars => this.sentenciaUpdate(2, bloqueVars) + ';').join('\n') + `
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