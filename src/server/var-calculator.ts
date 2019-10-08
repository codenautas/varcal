import { Client, hasAlias, OperativoGenerator, quoteIdent, quoteLiteral, Relacion, tiposTablaDato, Variable } from "operativos";
import { AppVarCalType } from "./app-varcal";
import { ExpressionProcessor } from "./expression-processor";
import { BloqueVariablesCalc } from "./types-varcal";
import { VariableCalculada } from "./variable-calculada";
import { fullUnIndent, indent } from "./indenter";

export class VarCalculator extends ExpressionProcessor {

    private allSqls: string[] = []
    private drops: string[] = []
    private inserts: string[] = []

    private bloquesVariablesACalcular: BloqueVariablesCalc[] = [];
    // @ts-ignore https://github.com/codenautas/operativos/issues/4
    private funGeneradora: string;
    private nombreFuncionGeneradora: string = 'gen_fun_var_calc'
    calcVars: VariableCalculada[] = [];

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
            case 'ultimo':
                return 'last_agg(' + exp + ')';
            default:
                return f + '(' + exp + ')';
        }
    }
    
    private preCalculate(): void {
        this.getVarsCalculadas().forEach(vc=>this.prepareEC(vc));
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
        this.allSqls = ['do $SQL_DUMP$\n begin', "set search_path = " + this.app.config.db.schema + ';'].concat(this.allSqls).concat(this.funGeneradora, 'perform ' + this.nombreFuncionGeneradora + '();', this.getUpdateFechaCalculada(), 'end\n$SQL_DUMP$');
        // sin funcion generadora
        // this.allSqls = ['do $SQL_DUMP$\n begin', "set search_path = " + this.app.config.db.schema + ';'].concat(this.allSqls).concat(this.funGeneradora, updateFechaCalculada, 'end\n$SQL_DUMP$');
        return this.allSqls.join('\n----\n') + '--- generado: ' + new Date() + '\n';
    }
    
    @fullUnIndent()
    private getUpdateFechaCalculada(){
        return `
        UPDATE operativos SET calculada=now()::timestamp(0) WHERE operativo=${quoteLiteral(this.operativo)};
        UPDATE tabla_datos SET generada=now()::timestamp(0) WHERE operativo=${quoteLiteral(this.operativo)} AND tipo=${quoteLiteral(tiposTablaDato.calculada)};`;
    }

    @fullUnIndent()
    private armarFuncionGeneradora(): any {
        return `
        CREATE OR REPLACE FUNCTION ${this.app.config.db.schema}.${this.nombreFuncionGeneradora}() RETURNS TEXT
          LANGUAGE PLPGSQL AS
        $GENERATOR$
        declare
          v_sql text:=$THE_FUN$
        CREATE OR REPLACE FUNCTION update_varcal_por_encuesta("p_operativo" text, "p_id_caso" text) RETURNS TEXT
          LANGUAGE PLPGSQL AS
        $BODY$
        BEGIN
        -- Cada vez que se actualizan las variables calculadas, previamente se deben insertar los registros que no existan (on conflict do nothing)
        -- de las tablas base (solo los campos pks), sin filtrar por p_id_caso para update_varcal o con dicho filtro para update_varcal_por_encuesta
        ${this.inserts.map(i=>i+ `WHERE operativo=p_operativo AND ${quoteIdent(OperativoGenerator.mainTDPK)}=p_id_caso ON CONFLICT DO NOTHING;`).join('\n')}
          ${this.bloquesVariablesACalcular.map(bloqueVars => this.sentenciaUpdate(bloqueVars) + ';').join('\n')}
          RETURN 'OK';
        END;
        $BODY$;
        $THE_FUN$;
        begin 
          -- TODO: hacer este reemplazo en JS
          execute v_sql;
          execute replace(replace(replace(
            v_sql,
            $$update_varcal_por_encuesta("p_operativo" text, "p_id_caso" text) RETURNS TEXT$$, $$update_varcal("p_operativo" text) RETURNS TEXT$$),
            $$${quoteIdent(OperativoGenerator.mainTD)}.${quoteIdent(OperativoGenerator.mainTDPK)}=p_id_caso$$, $$TRUE$$),
            $$${quoteIdent(OperativoGenerator.mainTDPK)}=p_id_caso$$, $$TRUE$$);
          return '2GENERATED';
        end;
        $GENERATOR$;        
        `;
    }
    
    @indent()
    private buildAggregatedLateralsFromClausule(bloque:BloqueVariablesCalc):string{
        //saca duplicados de las tablas agregadas y devuelve un arreglo con solo el campo tabla_agregada
        let tablesToFromClausule:string='';
        let aggregationCalcVars = bloque.variablesCalculadas.filter(vc => vc.tabla_agregada && vc.tabla_agregada !=bloque.tabla.td_base);
        let tablasAgregadas = [...(new Set(<string[]>aggregationCalcVars.map(v => v.tabla_agregada)))];
        tablasAgregadas.forEach(tableAgg => {
            //TODO: when build tablasAgregadas store its variables instead of get here again
            let varsAgg = aggregationCalcVars.filter(vc => vc.tabla_agregada == tableAgg);
            
            // //TODO: improve concatenation, here we are trying to concat all ordered insumos TDNames for all variablesCalculadas of this bloque
            // let a:string[] =[];
            // varsAgg.forEach(vca=>a.push(...vca.orderedInsumosTDNames));
            // let involvedTDs:string[] = [...(new Set(a))]; // saca repetidos

            //TODO: analice use of filter clausule instead of "case when" for aggregation functions
            tablesToFromClausule += `
              ,LATERAL (
                SELECT
                    ${varsAgg.map(v => `
                    ${this.getAggregacion(<string>v.funcion_agregacion, v.expresionProcesada)} as ${v.variable}`).join(',\n')}
                FROM ${quoteIdent(tableAgg)}
                WHERE ${this.relVarPKsConditions(bloque.tabla.td_base, tableAgg)}
              ) ${tableAgg + OperativoGenerator.sufijo_agregacion}`
        });

        return tablesToFromClausule
    }
    
    private buildWHEREClausule(bloqueVars:BloqueVariablesCalc): string {
        const blockTDName = bloqueVars.tabla.tabla_datos;
        const blockTDRel = <Relacion>this.myRels.find(r=>r.tiene == blockTDName);
        return `WHERE ${this.relVarPKsConditions(blockTDRel.tabla_datos, blockTDName)} AND ${quoteIdent(OperativoGenerator.mainTD)}."operativo"=p_operativo AND ${quoteIdent(OperativoGenerator.mainTD)}.${quoteIdent(OperativoGenerator.mainTDPK)}=p_id_caso`;
    }

    @indent()
    private buildSETClausuleForVC(vc: VariableCalculada):string {
        let expresion = (vc.tabla_agregada && vc.funcion_agregacion) ?
            `${vc.tabla_agregada + OperativoGenerator.sufijo_agregacion}.${vc.variable}` :
            // vc.expresionProcesada;
            this.getWrappedExpression(vc.expresionProcesada, vc.lastTD.getQuotedPKsCSV());
        return `
              ${vc.variable} = ${expresion}`;
    }

    private async generateSchemaAndLoadTableDefs() {
        let sqls = await this.app.dumpDbSchemaPartial(this.app.generateAndLoadTableDefs(), {});
        this.allSqls = [this.drops.join('\n'), sqls.mainSql].concat(this.inserts.map(i=>i+';'))
    }

    private generateTDDropsAndInserts() {
        this.getTDCalculadas().forEach(td => {
            this.drops.unshift("drop table if exists " + quoteIdent(td.getTableName()) + ";");
            let insert = `
            INSERT INTO ${quoteIdent(td.getTableName())} (${td.getQuotedPKsCSV()}) 
              SELECT ${td.getQuotedPKsCSV()} FROM ${quoteIdent(td.td_base)}`
            this.inserts.push(insert);
        })
    }

    private sentenciaUpdate(bloque: BloqueVariablesCalc): string {
        return `
          UPDATE ${bloque.tabla.getTableName()}
            SET 
              ${bloque.variablesCalculadas.map(vc => this.buildSETClausuleForVC(vc)).join(',\n')}
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

    private getOptInsumosInBloque(bloque: BloqueVariablesCalc) {
        let insumosOptionalRelations: Relacion[] = [];
        bloque.variablesCalculadas.forEach(vc => {
            insumosOptionalRelations.push(...vc.insumosOptionalRelations);
        });
        //removing duplicated
        insumosOptionalRelations = [...(new Set(insumosOptionalRelations))];
        return insumosOptionalRelations;
    }

    //########## protected methods
    protected buildClausulaFrom(bloque:BloqueVariablesCalc): string {
        const insumosOptionalRelations: Relacion[] = this.getOptInsumosInBloque(bloque);
        //building from clausule upside from the bloque table (not for all TDNames)
        return 'FROM ' + this.buildEndToEndJoins(bloque.tabla.td_base) +
            this.buildAggregatedLateralsFromClausule(bloque) + 
            this.buildOptRelationsFromClausule(insumosOptionalRelations);
    }    
}