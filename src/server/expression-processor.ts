import { OperativoGenerator, Relacion, Variable, hasAlias, quoteIdent } from "operativos";
import { Insumos, parse, Compiler, BaseNode, CompilerOptions } from "expre-parser";
import { ExpressionContainer } from "expression-container";
import { compilerOptions } from "variable-calculada";

export class ExpressionProcessor extends OperativoGenerator{

    protected optionalRelations: Relacion[]=[];

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

            let rel = this.getAliasIfOptionalRelation(varName);
            varAlias = rel ? rel.tabla_busqueda : varAlias

            varsFound = varsFound.filter(v => v.tabla_datos == varAlias);
        }
        return varsFound.filter(v => v.variable == rawVarName);
    }


    private addMainTD(insumosAliases: string[]) {
        //aliases involved in this consistence expresion
        if (insumosAliases.indexOf(OperativoGenerator.mainTD) == -1) {
            insumosAliases.push(OperativoGenerator.mainTD);
        }
        return insumosAliases;
    }

    private setInsumos(ec:ExpressionContainer){
        let bn:BaseNode = parse(ec.getExpression()); 
        ec.insumos = bn.getInsumos();
    }

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

    // protected methods
    protected getWrappedExpression(expression: string | number, pkExpression: string, options: CompilerOptions): string {
        var compiler = new Compiler(options);
        return compiler.toCode(parse(expression), pkExpression);
    }
    protected getAliasIfOptionalRelation(varName:string):Relacion|undefined{
        let rel:Relacion|undefined;
        if (hasAlias(varName)){
            let varAlias = varName.split('.')[0];
            rel = this.optionalRelations.find(rel => rel.que_busco == varAlias)
        }
        return rel
    }
    protected prepareEC(ec: ExpressionContainer): any {
        this.setInsumos(ec)
        this.validateInsumos(ec);
        this.filterOrderedTDs(ec); //tabla mas específicas (hija)
    }

    protected getInsumos(expression: string): Insumos {
        return parse(expression).getInsumos();
    }

    protected validateVar(varName: string): Variable {
        let varsFound:Variable[] = this.findValidVars(varName);
        this.checkFoundVarsForErrors(varsFound, varName);
        return varsFound[0];
    }

    protected buildOptRelationsFromClausule(insumosOptionalRelations: Relacion[]): string {
        //TODO: en el futuro habría que validar que participe del from la tabla de busqueda 
        return insumosOptionalRelations.map(r => this.joinRelation(r)).join('\n');
    }

    protected addAliasesToExpression(ec: ExpressionContainer) {
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
        let orderedInsumosIngresoTDNames: string[] = OperativoGenerator.orderedIngresoTDNames.filter(orderedTDName => tdsNeedByExpression.indexOf(orderedTDName) > -1);
        let orderedInsumosReferencialesTDNames: string[] = OperativoGenerator.orderedReferencialesTDNames.filter(orderedTDName => tdsNeedByExpression.indexOf(orderedTDName) > -1);
        ec.orderedInsumosTDNames = orderedInsumosIngresoTDNames.concat(orderedInsumosReferencialesTDNames);
        ec.lastTD = this.getUniqueTD(orderedInsumosIngresoTDNames[orderedInsumosIngresoTDNames.length - 1]);
    }

    protected buildClausulaWhere(ec:ExpressionContainer):string {
        ec.expresionValidada = this.getWrappedExpression(ec.getExpression(), ec.lastTD.getQuotedPKsCSV(), compilerOptions);
        return this.addAliasesToExpression(ec);
    }

    protected buildInsumosTDsFromClausule(orderedInsumosTDNames: string[]) {
        let clausula_from = 'FROM ' + quoteIdent(this.getUniqueTD(orderedInsumosTDNames[0]).getTableName());;
        //starting from 1 instead of 0
        for (let i = 1; i < orderedInsumosTDNames.length; i++) {
            let leftInsumoAlias = orderedInsumosTDNames[i - 1];
            let rightInsumoAlias = orderedInsumosTDNames[i];
            clausula_from += this.joinTDs(leftInsumoAlias, rightInsumoAlias);
        }
        return clausula_from;
    }
}