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
        ${this.inserts.map(i=>i+ ` WHERE operativo=p_operativo AND ${quoteIdent(OperativoGenerator.mainTDPK)}=p_id_caso ON CONFLICT DO NOTHING;`).join('\n')}
        ----
          ${this.bloquesVariablesACalcular.map(bloqueVars => this.sentenciaUpdate(bloqueVars) + ';').join('\n')}
          RETURN 'OK';
        END;
        $BODY$;
        $THE_FUN$;
        begin 
          -- TODO: hacer este reemplazo en JS
          execute v_sql;
          execute replace(regexp_replace(replace(
            v_sql,
            $$update_varcal_por_encuesta("p_operativo" text, "p_id_caso" text) RETURNS TEXT$$, $$update_varcal("p_operativo" text) RETURNS TEXT$$),
            $$(.* )".*"\\.${quoteIdent(OperativoGenerator.mainTDPK)}=p_id_caso(.*)$$, $$\\1TRUE\\2$$,'gm'),
            $$${quoteIdent(OperativoGenerator.mainTDPK)}=p_id_caso$$, $$TRUE$$);
          return '2GENERATED';
        end;
        $GENERATOR$;        
        `;
    }
    
    @indent()
    private buildAggLateralFromClausule(bloque:BloqueVariablesCalc):string{
        let tablesToFromClausule:string='';
        // all this separated managemente for tablasCompletas and tablasAgregadas is just for
        // the Eder operative where we need completitud variables
        // TODO: just override this method in the operative "EderVarCalculator" and restore this method
        let tablasAgregadas: {[index:string]:VariableCalculada[]} = {};
        let tablasCompletas: {[index:string]:VariableCalculada[]} = {};
        bloque.variablesCalculadas.forEach(vc=> {
            if (vc.tabla_agregada){
                if (vc.tabla_agregada == bloque.tabla.td_base){
                    if (!tablasCompletas[vc.tabla_agregada]){
                        tablasCompletas[vc.tabla_agregada] = [];
                    }
                    tablasCompletas[vc.tabla_agregada].push(vc);
                } else{
                    if (!tablasAgregadas[vc.tabla_agregada]){
                        tablasAgregadas[vc.tabla_agregada] = [];
                    }
                    tablasAgregadas[vc.tabla_agregada].push(vc);
                }
            } 
        })

        Object.keys(tablasAgregadas).forEach(aggTableName => {
            //TODO: analice use of filter clausule instead of "case when" for aggregation functions
            tablesToFromClausule += `
              ,LATERAL (
                SELECT
                ${this.getLateralSelectClausule(tablasAgregadas[aggTableName], aggTableName)}
                WHERE ${this.relVarPKsConditions(bloque.tabla.td_base, aggTableName)}
              ) as ${aggTableName + OperativoGenerator.sufijo_agregacion}
              `
        });
        
        // this is just for eder
        Object.keys(tablasCompletas).forEach(aggTableName => {
            //TODO: analice use of filter clausule instead of "case when" for aggregation functions
            tablesToFromClausule += `
              ,(SELECT ${this.getUniqueTD(aggTableName).getQuotedPKsCSV()},
               ${this.getLateralSelectClausule(tablasCompletas[aggTableName], aggTableName)}) as ${aggTableName + OperativoGenerator.sufijo_complete}
              AND agregar _comp ${this.relVarPKsConditions(aggTableName, bloque.tabla.tabla_datos)}`
        });

        return tablesToFromClausule
    }

    // TODO: just override this method in the operative "EderVarCalculator" and restore this method
    private getLateralSelectClausule(varsAgg:VariableCalculada[], aggTableName:string) {
        let result = `${varsAgg.map(v => `${v.parseAggregation()} as ${v.variable}`).join(',\n')}
            FROM ${quoteIdent(aggTableName)}` 
        //TODO: add joins dinamically checking the TDs involved in agg expression (filter + expression)
        let aggTDHasCalculated = this.myRels.find(r=> r.tabla_datos==aggTableName && r.misma_pk);
        if (aggTDHasCalculated) {
            const calculatedTDOfAggTD =this.getUniqueTD(aggTDHasCalculated.tiene);
            result += ` JOIN ${quoteIdent(calculatedTDOfAggTD.getTableName())} using (${calculatedTDOfAggTD.getQuotedPKsCSV()})`;
        }
        return result; 
    }
    
    private buildWHEREClausule(block:BloqueVariablesCalc): string {
        const blockTDName = block.tabla.tabla_datos;
        const blockTDRel = <Relacion>this.myRels.find(r=>r.tiene == blockTDName);
        const blockFirstTD = this.oldestAncestorIn(block.getTDsInvolved());
        return `WHERE ${this.relVarPKsConditions(blockTDRel.tabla_datos, blockTDName)} AND ${quoteIdent(blockFirstTD)}."operativo"=p_operativo AND ${quoteIdent(blockFirstTD)}.${quoteIdent(OperativoGenerator.mainTDPK)}=p_id_caso`;
    }

    @indent()
    private buildSETClausuleForVC(vc: VariableCalculada):string {
        let expresion = (vc.tabla_agregada && vc.funcion_agregacion) ?
            `${vc.tabla_agregada+vc.getAggTableSufix()}.${vc.variable}` :
            this.getWrappedExpression(vc.expresionProcesada, vc);
        return `${vc.variable} = ${expresion}`;
    }            

    private async generateSchemaAndLoadTableDefs() {
        let sqls = await this.app.dumpDbSchemaPartial(this.app.generateAndLoadTableDefs(), {});
        this.allSqls = [this.drops.join('\n'), sqls.mainSql].concat(this.inserts.map(i=>i+';').join('\n'))
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

    //########## protected methods
    protected buildClausulaFrom(bloque:BloqueVariablesCalc): string {
        return 'FROM ' + this.buildEndToEndJoins(bloque.getTDsInvolved()) +
            this.buildAggLateralFromClausule(bloque) + 
            this.buildOptRelationsFromClausule(bloque.getOptInsumos());
    }    
}