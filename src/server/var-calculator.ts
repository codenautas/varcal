import { ExpressionProcessor } from "expression-processor";
import { Client, hasAlias, OperativoGenerator, Relacion, tiposTablaDato } from "operativos";
import { quoteIdent, quoteLiteral } from "pg-promise-strict";
import { AppVarCalType } from "./app-varcal";
import { BloqueVariablesCalc } from "./types-varcal";
import { compilerOptions, VariableCalculada } from "./variable-calculada";

export class VarCalculator extends ExpressionProcessor {

    private allSqls: string[] = []
    private drops: string[] = []
    private inserts: string[] = []

    private bloquesVariablesACalcular: BloqueVariablesCalc[] = [];
    // @ts-ignore https://github.com/codenautas/operativos/issues/4
    private funGeneradora: string;
    private nombreFuncionGeneradora: string = 'gen_fun_var_calc'

    //########## public methods
    constructor(public app: AppVarCalType, client: Client, operativo: string) {
        super(client, operativo);
    }

    // for future management of insumos with ComplexExpression
    // preProcess(vcs:VariableCalculada[]){
    //     vcs.forEach(vc=> {
    //         this.buildExpression(vc)
    //     })
    //     super.preProcess(vcs);
    // }

    async fetchDataFromDB() {
        await super.fetchDataFromDB();
        this.getVarsCalculadas().forEach(vcalc => Object.setPrototypeOf(vcalc, VariableCalculada.prototype));
    }
    getTDCalculadas() {
        return this.myTDs.filter(td => td.esCalculada());
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

    //########## private methods
    private getAggregacion(f: string, exp: string) {
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
    
    private preCalculate(): void {
        this.getVarsCalculadas().forEach(vc=>{
            this.buildExpression(vc)
            this.prepareEC(vc)

            let tdPks = this.getTDFor(vc).getQuotedPKsCSV();
            vc.expresionValidada = this.getWrappedExpression(this.addAliasesToExpression(vc), tdPks, compilerOptions);
        });
    }

    private getVarsCalculadas(): VariableCalculada[] {
        return <VariableCalculada[]>this.myVars.filter(v => v.esCalculada())
    }

    private getNonCalcVars() {
        return this.myVars.filter(v => !v.esCalculada());
    }

    private getRelevamientoVars() {
        return this.getNonCalcVars();
    }

    private getFinalSql(): string {
        let updateFechaCalculada = `
        UPDATE operativos SET calculada=now()::timestamp(0) WHERE operativo=${quoteLiteral(this.operativo)};
        UPDATE tabla_datos SET generada=now()::timestamp(0) WHERE operativo=${quoteLiteral(this.operativo)} AND tipo=${quoteLiteral(tiposTablaDato.calculada)};`;

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
    
    private buildAggregatedLateralsFromClausule(txtMargen:string, bloque:BloqueVariablesCalc):string{
        //saca duplicados de las tablas agregadas y devuelve un arreglo con solo el campo tabla_agregada
        let tablesToFromClausule:string='';
        let tablasAgregadas = [...(new Set(bloque.variablesCalculadas.filter(v => v.tabla_agregada).map(v => v.tabla_agregada)))];
        tablasAgregadas.forEach(tabAgg => {
            //TODO: when build tablasAgregadas store its variables
            let varsAgg = bloque.variablesCalculadas.filter(vc => vc.tabla_agregada == tabAgg);
            
            let involvedTDs:string[] = [...(new Set([].concat.apply(varsAgg.map(vca=>vca.orderedInsumosTDNames))))] 
            tablesToFromClausule +=
                `${txtMargen}, LATERAL (
                ${txtMargen}   SELECT
                ${txtMargen}       ${varsAgg.map(v => `${this.getAggregacion(v.funcion_agregacion, v.expresionValidada)} as ${v.variable}`).join(',\n          ' + txtMargen)}
                ${txtMargen}     ${this.buildInsumosTDsFromClausule(involvedTDs)}
                ${txtMargen}     WHERE ${this.samePKsConditions(involvedTDs[0], involvedTDs[involvedTDs.length-1])}
                ${txtMargen} ) ${tabAgg + OperativoGenerator.sufijo_agregacion}`
        });

        return tablesToFromClausule
    }

    private buildExpression(vc: VariableCalculada): void {
        //extract that validation to a better place
        if ((!vc.opciones || !vc.opciones.length) && !vc.expresion) {
            throw new Error('La variable ' + vc.variable + ' no puede tener expresión y opciones nulas simultaneamente');
        }

        vc.expresion=vc.expresion||'';
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

    private buildWHEREClausule(txtMargen: string, bloqueVars:BloqueVariablesCalc): string {
        let baseTable = (<Relacion>this.myRels.find(r=>r.tabla_datos==bloqueVars.tabla.tabla_datos)).que_busco;
        return `\n  ${txtMargen}WHERE ${this.samePKsConditions(baseTable, bloqueVars.tabla.tabla_datos)}`;
    }
    private buildSETClausule(txtMargen: string, bloqueVars: BloqueVariablesCalc) {
        return bloqueVars.variablesCalculadas.map(vc => vc.buildSetClausule()).join(`,\n      ${txtMargen}`);
    }

    private async generateSchemaAndLoadTableDefs() {
        let sqls = await this.app.dumpDbSchemaPartial(this.app.generateAndLoadTableDefs(), {});
        this.allSqls = this.drops.concat(sqls.mainSql).concat(sqls.enancePart).concat(this.inserts)
    }

    private generateTDDropsAndInserts() {
        this.getTDCalculadas().forEach(td => {
            this.drops.unshift("drop table if exists " + quoteIdent(td.getTableName()) + ";");
            let insert = `INSERT INTO ${quoteIdent(td.getTableName())} (${td.getQuotedPKsCSV()}) SELECT ${td.getQuotedPKsCSV()} FROM ${quoteIdent(td.que_busco)};` //estParaGenTabla.sourceJoin + ";");
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

    private separarEnGruposOrdenados() {
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

    private sortCalcVariablesByDependency():VariableCalculada[] {
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

    private getTDsInBloque(bloque: BloqueVariablesCalc) {
        let insumosOptionalRelations: Relacion[] = [];
        let orderedInsumosTDNames: string[] = [];
        bloque.variablesCalculadas.forEach(vc => {
            insumosOptionalRelations.push(...vc.insumosOptionalRelations);
            orderedInsumosTDNames.push(...vc.orderedInsumosTDNames);
        });
        //removing duplicated
        insumosOptionalRelations = [...(new Set(insumosOptionalRelations))];
        orderedInsumosTDNames = [...(new Set(orderedInsumosTDNames))];
        return { orderedInsumosTDNames, insumosOptionalRelations };
    }

    //########## protected methods
    protected buildClausulaFrom(txtMargen:string, bloque:BloqueVariablesCalc): string {
        let { orderedInsumosTDNames, insumosOptionalRelations }: { orderedInsumosTDNames: string[]; insumosOptionalRelations: Relacion[]; } = this.getTDsInBloque(bloque);
        return this.buildInsumosTDsFromClausule(orderedInsumosTDNames) +
            this.buildAggregatedLateralsFromClausule(txtMargen, bloque) + 
            this.buildOptRelationsFromClausule(insumosOptionalRelations);
    }    
}