import * as ExpresionParser from 'expre-parser';
import { DetailTable } from 'operativos';

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

export interface Joins {
    tabla: string,
    clausulaJoin: string
};

export interface VariableGenerable{
    tabla?: string
    nombreVariable: string
    expresionValidada: string
    funcion_agregacion?: 'contar' | 'sumar'
    tabla_agregada?: string
    insumos?: ExpresionParser.Insumos
    joins?: Joins[]
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
    joins?: Joins[]
};

export type DefinicionEstructuralTabla = {
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