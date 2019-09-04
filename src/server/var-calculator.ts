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
    private deletes: string[] = []

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
        this.generateTDDropsAndInsertsAndDeletes();
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
          --Los inserts siguientes tienen que ir acá porque esta funcion es la que se va a correr 
          -- cuando se ingrese/guarde una encuesta nueva (update_varcal_por_encuesta), ya que cuando se guarda 
          -- una nueva encuesta se consiste, y el consistir llama a esta función, pero como la encuesta es nueva
          -- los registros de la tabla "encuesta_calculada" no existen, entonces se deben insertar

          -- TODO: el delete es para poder usar esta misma funcion cuando la encuesta no es nueva, mejorar poniendole
          -- a los inserts una condición, por ej ON CONFLICT DO NOTHING/UPDATE , para sacar los delete

          -- en update_varcal comentamos inserts y deletes porque se asume que están todas las encuestas
          -- reflejadas en la tabla calculada, porque al presionar "devolver" en una encuesta la misma se consiste y se
          -- agrega en calculadas si no existe (ver comentario de mas arriba)
          -- ojo!! En eder no tenemos la funcionalidad de que toda encuesta se consista automaticamente al salir
          -- Pero ojo, además, en Eder aveces se borran encuestas viejas y siempre llegan nuevas por lo que habría que dejar estos delete e inserts
        ${this.deletes.join('\n')}
        ----
        ${this.inserts.join('\n')}
          ${this.bloquesVariablesACalcular.map(bloqueVars => this.sentenciaUpdate(bloqueVars) + ';').join('\n')}
          RETURN 'OK';
        END;
        $BODY$;
        $THE_FUN$;
        begin 
          -- TODO: hacer este reemplazo en JS
          execute v_sql;
          execute replace(replace(replace(replace(replace(
            v_sql,
            $$update_varcal_por_encuesta("p_operativo" text, "p_id_caso" text) RETURNS TEXT$$, $$update_varcal("p_operativo" text) RETURNS TEXT$$),
            $$${OperativoGenerator.mainTD}.id_caso=p_id_caso$$, $$TRUE$$),
            $$id_caso=p_id_caso$$, $$TRUE$$),
            $$DELETE FROM$$, $$--DELETE FROM$$),
            $$INSERT INTO$$, $$--INSERT INTO$$);
          return '2GENERATED';
        end;
        $GENERATOR$;        
        `;
    }
    
    @indent()
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
            let involvedTDs:string[] = [...(new Set(a))]; // saca repetidos
            tablesToFromClausule += `
              ,LATERAL (
                SELECT
                    ${varsAgg.map(v => `
                    ${this.getAggregacion(<string>v.funcion_agregacion, v.expresionProcesada)} as ${v.variable}`).join(',\n')}
                FROM ${involvedTDs[involvedTDs.length-1]}
                ${involvedTDs.length>1 ? 'WHERE' + this.relVarPKsConditions(involvedTDs[involvedTDs.length-2], involvedTDs[involvedTDs.length-1]): ''}
              ) ${tabAgg + OperativoGenerator.sufijo_agregacion}`
        });

        return tablesToFromClausule
    }

    private buildWHEREClausule(bloqueVars:BloqueVariablesCalc): string {
        const blockTDName = bloqueVars.tabla.tabla_datos;
        const blockTDRel = <Relacion>this.myRels.find(r=>r.tiene == blockTDName);
        return `WHERE ${this.relVarPKsConditions(blockTDRel.tabla_datos, blockTDName)}`;
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
        this.allSqls = [this.drops.join('\n'), sqls.mainSql, sqls.enancePart]
    }

    private generateTDDropsAndInsertsAndDeletes() {
        const whereClausle = ` WHERE operativo=p_operativo AND ${quoteIdent(OperativoGenerator.mainTDPK)}=p_id_caso;`;
        this.getTDCalculadas().forEach(td => {
            this.drops.unshift("drop table if exists " + quoteIdent(td.getTableName()) + ";");
            let insert = `
            INSERT INTO ${quoteIdent(td.getTableName())} (${td.getQuotedPKsCSV()}) SELECT ${td.getQuotedPKsCSV()} FROM ${quoteIdent(td.td_base) + whereClausle}`
            this.inserts.push(insert);
            this.deletes.push(`
            DELETE FROM ${quoteIdent(td.getTableName()) + whereClausle}`);
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
        return this.buildInsumosTDsFromClausule(orderedInsumosTDNames) + '\n' +
            this.buildAggregatedLateralsFromClausule(bloque) + 
            this.buildOptRelationsFromClausule(insumosOptionalRelations);
    }    
}