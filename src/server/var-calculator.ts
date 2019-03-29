import { Insumos, parse, Compiler, CompilerOptions, BaseNode } from "expre-parser";
import { Client, hasAlias, OperativoGenerator, Relacion, tiposTablaDato, Variable, Operativo, TablaDatos } from "operativos";
import { quoteIdent } from "pg-promise-strict";
import { AppVarCalType } from "./app-varcal";
import { ExpressionContainer } from "./expression-container";
import { BloqueVariablesCalc, VariableCalculada } from "./types-varcal";
import { compilerOptions } from "./variable-calculada";


export class VarCalculator extends OperativoGenerator {

    private allSqls: string[] = []
    private drops: string[] = []
    private inserts: string[] = []

    private bloquesVariablesACalcular: BloqueVariablesCalc[] = [];
    // @ts-ignore https://github.com/codenautas/operativos/issues/4
    private funGeneradora: string;
    private nombreFuncionGeneradora: string = 'gen_fun_var_calc'

    constructor(public app: AppVarCalType, client: Client, operativo: string) {
        super(client, operativo);
    }

    async fetchDataFromDB() {
        await super.fetchDataFromDB();
        //converting to type varCalculadas
        this.getVarsCalculadas().forEach(vcalc => Object.setPrototypeOf(vcalc, VariableCalculada.prototype));
        this.optionalRelations = this.myRels.filter(rel => rel.tipo == 'opcional');
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

    getTDFor(v:VariableCalculada): TablaDatos{
        return this.myTDs.find(td => td.operativo == v.operativo && td.tabla_datos == v.tabla_datos);
    }

    protected optionalRelations: Relacion[]=[];

    private validateAliases(aliases: string[]): any {
        let validAliases = this.getValidAliases();
        aliases.forEach(alias => {
            if (validAliases.indexOf(alias) == -1) {
                throw new Error('El alias "' + alias + '" no se encontró en la lista de alias válidos: ' + validAliases.join(', '));
            }
        });
    }
    private getValidAliases(): string[]{
        let validRelationsNames = this.optionalRelations.map(rel => rel.que_busco)
        return this.myTDs.map(td => td.tabla_datos).concat(validRelationsNames);
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

    private validateInsumos(ec:ExpressionContainer): void {
        this.validateOverwritingNames(ec.insumos);
        this.validateFunctions(ec.insumos.funciones);
        this.validateAliases(ec.insumos.aliases);
        this.validateVars(ec)
    }

    private validateOverwritingNames(insumos: Insumos): void {
        if (insumos.funciones) {
            insumos.variables.forEach(varName => {
                if (insumos.funciones.indexOf(varName) > -1) {
                    throw new Error('La variable "' + varName + '" es también un nombre de función');
                }
            })
        }
    }

    private validateVars(ec:ExpressionContainer): void {
        ec.insumos.variables.forEach(vName => {
            let foundVar = this.validateVar(vName);
            if ( ! ec.tdsNeedByExpression.find(tdName=> tdName == foundVar.tabla_datos)){
                ec.tdsNeedByExpression.push(foundVar.tabla_datos)
            } 
        })
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
        let varsFound: Variable[] = this.myVars;
        if (hasAlias(varName)) {
            let varAlias: string;
            [varAlias, rawVarName] = varName.split('.');

            let rel = this.getAliasIfOptionalRelation(varName);
            varAlias = rel ? rel.tabla_busqueda : varAlias

            varsFound = varsFound.filter(v => v.tabla_datos == varAlias);
        }
        return varsFound.filter(v => v.variable == rawVarName);
    }

    protected getAliasIfOptionalRelation(varName:string):Relacion{
        let rel:Relacion;
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
        this.validateInsumos(ec);
        this.filterOrderedTDs(ec); //tabla mas específicas (hija)
    }

    private setInsumos(ec:ExpressionContainer){
        let bn:BaseNode = parse(ec.getExpression()); 
        ec.insumos = bn.getInsumos();
    }
    
    private preCalculate(): void {
        this.getVarsCalculadas().forEach(vc=>{
            this.buildExpression(vc)
            this.prepareEC(vc)

            let tdPks = this.getTDFor(vc).getQuotedPKsCSV();
            vc.expresionValidada = this.getWrappedExpression(this.addAliasesToExpression(vc), tdPks, compilerOptions);
        });
    }

    buildExpression(vc: VariableCalculada): void {
        if ((!vc.opciones || !vc.opciones.length) && !vc.expresion) {
            throw new Error('La variable ' + vc.variable + ' no puede tener expresión y opciones nulas simultaneamente');
        }
        
        if (vc.opciones && vc.opciones.length) {
            vc.expresionValidada = 'CASE ' + vc.opciones.map(opcion => {
                return '\n          WHEN ' + opcion.expresion_condicion +
                    ' THEN ' + opcion.expresion_valor || opcion.opcion
            }).join('') + (vc.expresion ? '\n          ELSE ' + vc.expresion : '') + ' END'
        } else {
            vc.expresionValidada = vc.expresion;
        }
        if (vc.filtro) {
            vc.expresionValidada = 'CASE WHEN ' + vc.filtro + ' THEN ' + vc.expresionValidada + ' ELSE NULL END'
        }
    }

    protected filterOrderedTDs(ec:ExpressionContainer) {
        //put in constructor
        // TODO: ORDENAR dinamicamente:
        // primero: la td que no tenga ninguna TD en que busco es la principal
        // segundas: van todas las tds que tengan en "que_busco" a la principal
        // terceras: las tds que tengan en "que busco" a las segundas
        // provisoriamente se ordena fijando un arreglo ordenado
        // TODO: deshardcodear main TD

        let tdsNeedByExpression = this.addMainTD(ec.tdsNeedByExpression);
        ec.insumosOptionalRelations = this.optionalRelations.filter(r => ec.insumos.aliases.indexOf(r.que_busco) > -1);
        let orderedInsumosIngresoTDNames: string[] = VarCalculator.orderedIngresoTDNames.filter(orderedTDName => tdsNeedByExpression.indexOf(orderedTDName) > -1);
        let orderedInsumosReferencialesTDNames: string[] = VarCalculator.orderedReferencialesTDNames.filter(orderedTDName => tdsNeedByExpression.indexOf(orderedTDName) > -1);
        ec.orderedInsumosTDNames = orderedInsumosIngresoTDNames.concat(orderedInsumosReferencialesTDNames);
        ec.lastTD = this.getUniqueTD(orderedInsumosIngresoTDNames[orderedInsumosIngresoTDNames.length - 1]);
    }

    protected buildClausulaWhere(ec:ExpressionContainer):string {
        ec.expresionValidada = this.getWrappedExpression(ec.getExpression(), ec.lastTD.getQuotedPKsCSV(), compilerOptions);
        return this.addAliasesToExpression(ec);
    }
    
    protected buildClausulaFrom(txtMargen:string, bloque:BloqueVariablesCalc): string {
        let insumosOptionalRelations:Relacion[]=[];
        let orderedInsumosTDNames:string[]=[];
        // bloque.variablesCalculadas(vc=>{
        //     insumosOptionalRelations
        //     orderedInsumosTDNames
        // })
        return this.buildInsumosTDsFromClausule(orderedInsumosTDNames) + this.buildAggregatedLateralsFromClausule(txtMargen, bloque) + this.buildOptRelationsFromClausule(insumosOptionalRelations);
    }

    private buildInsumosTDsFromClausule(orderedInsumosTDNames: string[]) {
        let clausula_from = 'FROM ' + quoteIdent(this.getUniqueTD(orderedInsumosTDNames[0]).getTableName());;
        //starting from 1 instead of 0
        for (let i = 1; i < orderedInsumosTDNames.length; i++) {
            let leftInsumoAlias = orderedInsumosTDNames[i - 1];
            let rightInsumoAlias = orderedInsumosTDNames[i];
            clausula_from += this.joinTDs(leftInsumoAlias, rightInsumoAlias);
        }
        return clausula_from;
    }
    
    private buildAggregatedLateralsFromClausule(txtMargen:string, bloque:BloqueVariablesCalc):string{
        //saca duplicados de las tablas agregadas y devuelve un arreglo con solo el campo tabla_agregada
        let tablesToFromClausule:string;
        let tablasAgregadas = [...(new Set(bloque.variablesCalculadas.filter(v => v.tabla_agregada).map(v => v.tabla_agregada)))];
        tablasAgregadas.forEach(tabAgg => {
            let varsAgg = bloque.variablesCalculadas.filter(vc => vc.tabla_agregada == tabAgg);
            // TODO:
             falta ordenarlos
            let involvedTDs = [...(new Set([].concat.apply(varsAgg.map(vca=>vca.tdsNeedByExpression))))] 
            tablesToFromClausule = tablesToFromClausule.concat(
                `${txtMargen}LATERAL (
                ${txtMargen}   SELECT
                ${txtMargen}       ${varsAgg.map(v => `${this.getAggregacion(v.funcion_agregacion, v.expresionValidada)} as ${v.variable}`).join(',\n          ' + txtMargen)}
                ${txtMargen}     ${this.buildInsumosTDsFromClausule(involvedTDs)}
                ${txtMargen}     WHERE ${defEst.tables[tabAgg].whereAgg[bloque.ua]}
                ${txtMargen} ) ${tabAgg + OperativoGenerator.sufijo_agregacion}`
            );
        });

        return tablesToFromClausule
    }

    buildOptRelationsFromClausule(insumosOptionalRelations: Relacion[]): string {
        //TODO: en el futuro habría que validar que participe del from la tabla de busqueda 
        return insumosOptionalRelations.map(r => this.joinRelation(r)).join('\n');
    }

    async calculate(): Promise<string> {
        //for each TD, do SQL generation
        this.generateTDDropsAndInserts();
        await this.generateSchemaAndLoadTableDefs();
        
        //Variable Processing
        this.preCalculate();
        
        //variables blocks
        this.separarEnGruposOrdenados();
        this.armarFuncionGeneradora();
        return this.getFinalSql();
    }

    async generateSchemaAndLoadTableDefs() {
        let sqls = await this.app.dumpDbSchemaPartial(this.app.generateAndLoadTableDefs(), {});
        this.allSqls = this.drops.concat(sqls.mainSql).concat(sqls.enancePart).concat(this.inserts)
    }

    private generateTDDropsAndInserts() {
        this.getTDCalculadas().forEach(td => {
            this.drops.unshift("drop table if exists " + this.app.db.quoteIdent(td.getTableName()) + ";");
            let insert = `INSERT INTO ${this.app.db.quoteIdent(td.getTableName())} (${td.getQuotedPKsCSV()}) SELECT ${td.getQuotedPKsCSV()} FROM ${this.app.db.quoteIdent(td.que_busco)};` //estParaGenTabla.sourceJoin + ";");
            this.inserts.push(insert);
        })
    }

    private sentenciaUpdate(margen: number, bloque: BloqueVariablesCalc): string {
        var txtMargen = Array(margen + 1).join(' ');
        return `${txtMargen}UPDATE ${bloque.tabla.getTableName()}\n${txtMargen}  SET ` +
            this.buildSETClausule(txtMargen, bloque) +
            this.buildClausulaFrom(txtMargen, bloque) + 
            this.buildWHEREClausule(txtMargen, bloque);
    }
    

    buildWHEREClausule(txtMargen: string, bloqueVars:BloqueVariablesCalc): string {
        let tableDefEst = (defEst && defEst.tables && defEst.tables[definicion.ua]) ? defEst.tables[definicion.ua] : null;
        let defJoinExist: boolean = !!(definicion.joins && definicion.joins.length);
        let completeWhereConditions: string = '';
        if (tableDefEst || defJoinExist) {
            let defJoinsWhere = defJoinExist ? definicion.joins.map(def => def.clausulaJoin).join(`\n    ${txtMargen}AND `) : '';
            completeWhereConditions = tableDefEst && defJoinExist ? `(${tableDefEst.where}) AND (${defJoinsWhere})` : tableDefEst ? tableDefEst.where : defJoinsWhere;
        }

        return `\n  ${txtMargen}WHERE ${completeWhereConditions}`;
    }

    private buildSETClausule(txtMargen: string, bloqueVars: BloqueVariablesCalc) {
        return bloqueVars.variablesCalculadas.map(vc => vc.buildSetClausule()).join(`,\n      ${txtMargen}`);
    }

    private addAliasesToExpression(ec: ExpressionContainer) {
        ec.insumos.variables.forEach(varInsumoName => {
            let definedVarForInsumoVar = <Variable>this.myVars.find(v => v.variable == varInsumoName);
            //TODO: No usar directamente el alias escrito por el usuario sino el getTableName de dicho TD (cuando sea un TD)
            let [varAlias, insumoVarRawName] = hasAlias(varInsumoName) ?
                varInsumoName.split('.') : [definedVarForInsumoVar.tabla_datos, varInsumoName];

            let td = this.myTDs.find(td => td.tabla_datos == varAlias);
            if (td) {
                varAlias = td.getTableName();
            }

            // match all varNames used alone (don't preceded nor followed by "."): 
            // match: p3 ; (23/p3+1); max(13,p3)
            // don't match: alias.p3, p3.column, etc
            let baseRegex = `(?<!\\.)\\b(${varInsumoName})\\b(?!\\.)`;
            let completeVar = quoteIdent(varAlias) + '.' + quoteIdent(insumoVarRawName);
            ec.expresionValidada = ec.expresionValidada.replace(new RegExp(baseRegex, 'g'), completeVar);
        });
        return ec.expresionValidada;
    }

    separarEnGruposOrdenados() {
        let orderedCalcVars: VariableCalculada[] = this.sortCalcVariablesByDependency();
        orderedCalcVars.forEach((vCalc: VariableCalculada) => {
            if (this.bloquesVariablesACalcular.length == 0) {
                this.bloquesVariablesACalcular.push(new BloqueVariablesCalc(vCalc));
            }
            else {
                var enNivel:number = vCalc.insumos.variables.length ?
                    Math.max(...(vCalc.insumos.variables.map(varInsumo => this.bloquesVariablesACalcular.findIndex(bloque => bloque.variablesCalculadas.findIndex(vcal => vcal.variable == varInsumo) == -1 ? false : true)))) :
                    0;
                if (enNivel >= 0 && this.bloquesVariablesACalcular.length === enNivel + 1) {
                    this.bloquesVariablesACalcular.push(new BloqueVariablesCalc(vCalc));
                }
                else {
                    let tabla = vCalc.tabla_datos;
                    var nivelTabla = this.bloquesVariablesACalcular[enNivel + 1].tabla.tabla_datos == tabla ? enNivel + 1 : this.bloquesVariablesACalcular.findIndex(function (nivel, i) {
                        return nivel.tabla.tabla_datos == tabla && i > enNivel + 1;
                    });
                    if (nivelTabla >= 0) {
                        this.bloquesVariablesACalcular[nivelTabla].variablesCalculadas.push(vCalc);
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
        *  nonDefinedVars son las que variables a calcular cuyos insumos no están en definedVars
        * definedVars variables con insumos definidos
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

    getFinalSql(): string {
        let updateFechaCalculada = `
        UPDATE operativos SET calculada=now()::timestamp(0) WHERE operativo=${this.app.db.quoteLiteral(this.operativo)};
        UPDATE tabla_datos SET generada=now()::timestamp(0) WHERE operativo=${this.app.db.quoteLiteral(this.operativo)} AND tipo=${this.app.db.quoteLiteral(tiposTablaDato.calculada)};`;

        this.allSqls = ['do $SQL_DUMP$\n begin', "set search_path = " + this.app.config.db.schema + ';'].concat(this.allSqls).concat(this.funGeneradora, 'perform ' + this.nombreFuncionGeneradora + '();', updateFechaCalculada, 'end\n$SQL_DUMP$');
        // sin funcion generadora
        // this.allSqls = ['do $SQL_DUMP$\n begin', "set search_path = " + this.app.config.db.schema + ';'].concat(this.allSqls).concat(this.funGeneradora, updateFechaCalculada, 'end\n$SQL_DUMP$');
        return this.allSqls.join('\n----\n') + '--- generado: ' + new Date() + '\n';
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
}