import {quoteIdent, quoteLiteral, Client, hasAlias, OperativoGenerator, Relacion, tiposTablaDato, Variable } from "operativos";
import { AppVarCalType } from "./app-varcal";
import { ExpressionProcessor } from "./expression-processor";
import { BloqueVariablesCalc } from "./types-varcal";
import { VariableCalculada } from "./variable-calculada";
import { fullUnIndent } from "./indenter";

export class VarCalculator extends ExpressionProcessor {

    private allSqls: string[] = []
    private drops: string[] = []
    private inserts: string[] = []

    private bloquesVariablesACalcular: BloqueVariablesCalc[] = [];
    // @ts-ignore https://github.com/codenautas/operativos/issues/4
    private funGeneradora: string;
    private nombreFuncionGeneradora: string = 'gen_fun_var_calc'
    calcVars: VariableCalculada[] = [];

    static margin = 2;
    static txtMargin = Array(VarCalculator.margin + 1).join(' ');

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
        // changing type of calculated vars // Using assign instead of setPrototypeOf because we need to have initialized properties
        this.calcVars = this.myVars.filter(v=>v.clase == tiposTablaDato.calculada).map((v:Variable) => Object.assign(new VariableCalculada(), v));
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
        this.funGeneradora = this.armarFuncionGeneradora();
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
            this.prepareEC(vc)
        });
    }

    // override parent method
    protected prepareEC(vc:VariableCalculada){
        vc.validate()
        super.prepareEC(vc)
    }

    private getVarsCalculadas(): VariableCalculada[] {
        return this.calcVars;
    }
    
    private getRelevamientoVars() {
        return this.myVars.filter(v => !v.esCalculada());
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

    @fullUnIndent()
    private armarFuncionGeneradora(): any {
        return `
        CREATE OR REPLACE FUNCTION ${this.app.config.db.schema}.${this.nombreFuncionGeneradora}() RETURNS TEXT
          LANGUAGE PLPGSQL AS
        $BODY$
        BEGIN
          ${this.bloquesVariablesACalcular.map(bloqueVars => this.sentenciaUpdate(bloqueVars) + ';').join('\n')}
          RETURN 'OK';
        END;
        $BODY$;`;
    }
    
    private buildAggregatedLateralsFromClausule(bloque:BloqueVariablesCalc):string{
        //saca duplicados de las tablas agregadas y devuelve un arreglo con solo el campo tabla_agregada
        let tablesToFromClausule:string='';
        let tablasAgregadas = [...(new Set(bloque.variablesCalculadas.filter(v => v.tabla_agregada).map(v => v.tabla_agregada)))];
        tablasAgregadas.forEach(tabAgg => {
            //TODO: when build tablasAgregadas store its variables instead of get here again
            let varsAgg = bloque.variablesCalculadas.filter(vc => vc.tabla_agregada == tabAgg);
            
            //TODO: improve concatenation, here we are trying to concat all ordered insumos TDNames for all variablesCalculadas of this bloque
            let a:string[] =[];
            varsAgg.forEach(vca=>a.push(...vca.orderedInsumosTDNames));
            let involvedTDs:string[] = [...(new Set(a))] 
            tablesToFromClausule +=
                `${VarCalculator.txtMargin}, LATERAL (
                ${VarCalculator.txtMargin}   SELECT
                ${VarCalculator.txtMargin}       ${varsAgg.map(v => `${this.getAggregacion(<string>v.funcion_agregacion, v.expresionProcesada)} as ${v.variable}`).join(',\n          ' + VarCalculator.txtMargin)}
                ${VarCalculator.txtMargin}     ${this.buildInsumosTDsFromClausule(involvedTDs)}
                ${involvedTDs.length>1 ? VarCalculator.txtMargin + ' WHERE' /*+ this.relVarPKsConditions(involvedTDs[0], involvedTDs[involvedTDs.length-1])*/: ''}
                ${VarCalculator.txtMargin} ) ${tabAgg + OperativoGenerator.sufijo_agregacion}`
        });

        return tablesToFromClausule
    }

    private buildWHEREClausule(bloqueVars:BloqueVariablesCalc): string {
        const blockTDName = bloqueVars.tabla.tabla_datos;
        const blockTDRel = <Relacion>this.myRels.find(r=>r.tiene == blockTDName);
        return `\n  ${VarCalculator.txtMargin}WHERE ${this.relVarPKsConditions(blockTDRel.tabla_datos, blockTDName)}`;
    }
    private buildSETClausuleForBloque(bloqueVars: BloqueVariablesCalc) {
        return bloqueVars.variablesCalculadas.map(vc => this.buildSETClausuleForVC(vc)).join(`,\n${VarCalculator.txtMargin}`);
    }

    private buildSETClausuleForVC(vc: VariableCalculada):string {
        let expresion = (vc.tabla_agregada && vc.funcion_agregacion) ?
            `${vc.tabla_agregada + OperativoGenerator.sufijo_agregacion}.${vc.variable}` :
            // vc.expresionProcesada;
            this.getWrappedExpression(vc.expresionProcesada, vc.lastTD.getQuotedPKsCSV());
        return `${vc.variable} = ${expresion}`;
    }

    private async generateSchemaAndLoadTableDefs() {
        let sqls = await this.app.dumpDbSchemaPartial(this.app.generateAndLoadTableDefs(), {});
        this.allSqls = this.drops.concat(sqls.mainSql).concat(sqls.enancePart).concat(this.inserts)
    }

    private generateTDDropsAndInserts() {
        this.getTDCalculadas().forEach(td => {
            this.drops.unshift("drop table if exists " + quoteIdent(td.getTableName()) + ";");
            let insert = `INSERT INTO ${quoteIdent(td.getTableName())} (${td.getQuotedPKsCSV()}) SELECT ${td.getQuotedPKsCSV()} FROM ${quoteIdent(td.td_base)};` //estParaGenTabla.sourceJoin + ";");
            this.inserts.push(insert);
        })
    }

    private sentenciaUpdate(bloque: BloqueVariablesCalc): string {
        return `${VarCalculator.txtMargin}UPDATE ${bloque.tabla.getTableName()}
          SET 
            ${this.buildSETClausuleForBloque(bloque)}
            ${this.buildClausulaFrom(bloque)}
            ${this.buildWHEREClausule(bloque)}`
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
            var [alias, varName] = varInsumosName.split('.')
            //TODO: mejorar: debería chequear que la variable este definida en la TD correspondiente al alias
            // por ej: si el usuario escribe una expresión "referente.edad" chequear si la variable definida 'edad' además pertenece a la tabla "tabla_relacionada"
            if (definedVars.indexOf(varName) > -1 && this.validAliases.indexOf(alias) > -1) {
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
    protected buildClausulaFrom(bloque:BloqueVariablesCalc): string {
        let { orderedInsumosTDNames, insumosOptionalRelations }: { orderedInsumosTDNames: string[]; insumosOptionalRelations: Relacion[]; } = this.getTDsInBloque(bloque);
        return this.buildInsumosTDsFromClausule(orderedInsumosTDNames) +
            this.buildAggregatedLateralsFromClausule(bloque) + 
            this.buildOptRelationsFromClausule(insumosOptionalRelations);
    }    
}