import { BaseNode, Compiler, CompilerOptions, Insumos, parse } from "expre-parser";
import { Client, hasAlias, OperativoGenerator, quoteIdent, Relacion, Variable } from "operativos";
import { IExpressionContainer } from "./expression-container";
import { VariableCalculada } from "./variable-calculada";

//put these here is good because specifics apps could change/override this options depending on their own needs
export let compilerOptions: CompilerOptions = { language: 'sql', varWrapper: 'null2zero', divWrapper: 'div0err', elseWrapper: 'incomplete_else_error' };
export let pgWhiteList = ['div', 'avg', 'count', 'max', 'min', 'sum', 'coalesce', 'upper', 'lower', 'age', 'date_part', 'abs', 'to_number'];
export let comunSquemaWhiteList = ['informado','con_dato', 'sin_dato', 'nsnc', 'blanco'];
export let jsWhiteList = ['completar_valor_con_ultimo'];


export abstract class ExpressionProcessor extends OperativoGenerator{
    
    //TODO operativo is required, we only support one operativo per app
    constructor(public client:Client, public operativo: string){
        super(client,operativo)
    }

    //########## public methods

    // preProcess(ec:IExpressionContainer[]){
    //     ec.complexExp
    // }

    //########## private methods
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

            let optRel = this.getOptionalRelation(varAlias);
            varAlias = optRel ? optRel.tabla_relacionada : varAlias

            varsFound = varsFound.filter(v => v.tabla_datos == varAlias);
        }
        return varsFound.filter(v => v.variable == rawVarName);
    }

    // private addMainTD(insumosAliases: string[]) {
    //     //aliases involved in this consistence expresion
    //     if (insumosAliases.indexOf(OperativoGenerator.mainTD) == -1) {
    //         insumosAliases.push(OperativoGenerator.mainTD);
    //     }
    //     return insumosAliases;
    // }

    private setInsumos(ec:IExpressionContainer){
        let bn:BaseNode = parse(ec.expresionProcesada); 
        ec.insumos = bn.getInsumos();
    }

    private validateAliases(aliases: string[]): any {
        aliases.forEach(alias => {
            if (this.validAliases.indexOf(alias) == -1) {
                throw new Error('El alias "' + alias + '" no se encontró en la lista de alias válidos: ' + this.validAliases.join(', '));
            }
        });
    }

    private validateFunctions(funcNames: string[]) {
        funcNames.forEach(f => hasAlias(f)? this.validateFunctionSquema(f): this.validateFunctionName(f));
    }
    
    private validateFunctionName(f: string) {
        let functionWhiteList = pgWhiteList.concat(comunSquemaWhiteList).concat(jsWhiteList);
        if (functionWhiteList.indexOf(f) == -1) {
            throw new Error('La Función ' + f + ' no está incluida en la whiteList de funciones: ' + functionWhiteList.toString());
        }
    }

    private validateFunctionSquema(f: string) {
        if (f.split('.')[0] != 'dbo') {
            throw new Error('La Función ' + f + ' contiene un esquema inválido');
        }
    }

    private validateInsumos(ec:IExpressionContainer): void {
        this.validateOverwritingNames(ec.insumos);
        this.validateFunctions(ec.insumos.funciones);
        this.validateAliases(ec.insumos.aliases);
        this.validateVars(ec)
    }

    private validateOverwritingNames(insumos: Insumos): void {
        if (insumos.funciones.length) {
            insumos.variables.forEach(varName => {
                if (insumos.funciones.indexOf(varName) > -1) {
                    throw new Error('La variable "' + varName + '" es también un nombre de función');
                }
            })
        }
    }

    private validateVars(ec:IExpressionContainer): void {
        //TODO: mejorar este chequeo, hacer con herencia
        if ((<VariableCalculada>ec).tabla_agregada){
            // TODO: sacar factor común cuando es variable de agregacion
            // porque el validateVar se repite para ambos
            // TODO: use for of instead of foreach 
            ec.insumos.variables.forEach(vName => {
                this.validateVar(vName);
            })
            return;
        }
        ec.insumos.variables.forEach(vName => {
            let foundVar = this.validateVar(vName);
            ec.tdsInvolvedInExpr.push(foundVar.tabla_datos)
            const foundVarTdAsCalcTDRel = this.myRels.find(r=>r.tiene==foundVar.tabla_datos && r.misma_pk)
            if (foundVarTdAsCalcTDRel){
                ec.tdsInvolvedInExpr.push(foundVarTdAsCalcTDRel.tabla_datos)
            }
        })
        ec.tdsInvolvedInExpr = [... new Set(ec.tdsInvolvedInExpr)] //removing duplicates

        ec.first_td = this.oldestAncestorIn(ec.tdsInvolvedInExpr);
        ec.last_td = this.youngerDescendantIn(ec.tdsInvolvedInExpr);
    }

    // protected methods
    protected getWrappedExpression(expression: string | number, ec:IExpressionContainer): string {
        var compiler = new Compiler(compilerOptions);
        return compiler.toCode(parse(expression), this.getLastTD(ec).getPKsWitAlias());
    }

    protected prepareEC(ec: IExpressionContainer): void {
        ec.fusionUserExpressions();

        this.setInsumos(ec)
        this.validateInsumos(ec);

        ec.expresionProcesada = this.addAliasesToExpression(ec)
    }
 
    protected validateVar(varName: string): Variable {
        let varsFound:Variable[] = this.findValidVars(varName);
        //TODO: catch error and show the expression container who is checking its vars
        this.checkFoundVarsForErrors(varsFound, varName);
        return varsFound[0];
    }

    protected buildOptRelationsFromClausule(insumosOptionalRelations: Relacion[]): string {
        //TODO: en el futuro habría que validar que participe del from la tabla relacionada
        return insumosOptionalRelations.map(r => this.joinOptRelation(r)).join('\n');
    }

    protected addAliasesToExpression(ec: IExpressionContainer):string {
        let completeExpression = ec.expresionProcesada;
        ec.insumos.variables.forEach(varInsumoName => {
            let definedVarForInsumoVar = <Variable>this.myVars.find(v => v.variable == varInsumoName);
            let [varAlias, insumoVarRawName] = hasAlias(varInsumoName) ?
                varInsumoName.split('.') : [definedVarForInsumoVar.tabla_datos, varInsumoName];
            let td = this.myTDs.find(td => td.tabla_datos == varAlias);
            if (td) {
                varAlias = td.getTableName();
            }

            // we here replace varInsumoName with alias with the real tableName, for example:
            // for varInsumoName 'persona.p3' could be replaced with "operativo191_persona"."p3"
            // match all varNames used alone (don't preceded nor followed by "."): 
            // match: p3 ; (23/p3+1); max(13,p3);
            // don't match: alias.p3, p3.column, etc
            let baseRegex = `(?<!\\.)\\b(${varInsumoName})\\b(?!\\.)`;
            let completeVar = quoteIdent(varAlias) + '.' + quoteIdent(insumoVarRawName);
            completeExpression = completeExpression.replace(new RegExp(baseRegex, 'g'), completeVar);
        });
        return completeExpression;
    }
    
    getFirstTD(ec:IExpressionContainer){
        return this.getUniqueTD(<string>ec.first_td)
    }

    getLastTD(ec:IExpressionContainer){
        return this.getUniqueTD(<string>ec.last_td)
    }

    removeNull2ZeroWrapper(exp:string) {
        var regexSingleParamFunctions = /\b(informado|con_dato|sin_dato|nsnc|blanco)\(null2zero\(([^()]+)\)\)/gi;
        exp = exp.replace(regexSingleParamFunctions,'$1($2)')
        var regexCoalesce = /\b(coalesce)\(null2zero\(([^()]+)\) *, *null2zero\(([^()]+)\)\)/gi;
        return exp.replace(regexCoalesce,'$1($2,$3)');
    }
}