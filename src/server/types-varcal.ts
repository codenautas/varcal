import * as ExpresionParser from 'expre-parser';
import { DetailTable, ProcedureContext } from 'operativos';

// re-exports
export { Insumos, CompilerOptions} from 'expre-parser';
export * from 'operativos';

// new types definitions to export
export interface AliasDefEst{
    on: string
    tabla_datos: string
    where?: string
}

export interface Alias extends AliasDefEst{
    operativo: string
    alias: string
    descripcion?: string
}

export type PrefixedPks = {[key:string]: {pks:string[], pksString: string}};

export interface Join {
    tabla: string,
    clausulaJoin: string
};

export interface VariableGenerable{
    ua?: string
    tabla?: string
    nombreVariable: string
    expresionValidada: string
    funcion_agregacion?: 'contar' | 'sumar' | 'promediar'
    tabla_agregada?: string
    insumos?: ExpresionParser.Insumos
    joins?: Join[]
    aliases?: Aliases
}

export type ParametrosGeneracion = {
    nombreFuncionGeneradora: string,
    esquema: string
}

export type TextoSQL = string;

export type BloqueVariablesGenerables = {
    tabla: string
    variables: VariableGenerable[]
    ua?: string
    joins?: Join[]
};

export type DefinicionEstructuralTabla = {
    operativo?: string;
    target?: string;
    sourceBro?: string;
    pks?:string[];
    sourceJoin?: string;
    where?: string;
    aliasAgg?: string;
    sourceAgg?: string;
    whereAgg?:{ 
        [key: string]: string
    }    
    detailTables?: DetailTable[];
};

export type Tables = {
    [key: string]: DefinicionEstructuralTabla
}

export type DefinicionEstructural = {
    aliases?: Aliases
    tables: Tables
}

export interface VariableDefinida{
    tabla: string
    clase?: string
}

export interface VariablesDefinidas{
    [key:string]: VariableDefinida
}

export interface Aliases {
    [key: string]: AliasDefEst
}

export interface coreFunctionParameters{
    operativo: string
}

export type CoreFunction = (context: ProcedureContext, parameters: coreFunctionParameters) => Promise<DefinicionEstructural>;
