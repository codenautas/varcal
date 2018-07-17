"use strict";

import * as operativos from "operativos";

import {procedures} from "./procedures-varcal";
import { alias } from "./table-alias";
import { Client } from "pg-promise-strict";
import { TablaDatos, UnidadDeAnalisis, Request, tiposTablaDato } from "operativos";
import { DefinicionEstructural, DefinicionEstructuralTabla, sufijo_agregacion, generateConditions } from "./var-cal";
import { AliasDefEst } from "./types-varcal";


export * from './types-varcal';
export type Constructor<T> = new(...args: any[]) => T;

export function emergeAppVarCal<T extends Constructor<operativos.AppOperativosType>>(Base:T){
    
    return class AppVarCal extends Base{
        constructor(...args:any[]){
            super(...args);
            this.myProcedures = this.myProcedures.concat(procedures);
            this.myClientFileName = 'varcal';
        }
        defEstructural:DefinicionEstructural;

        async postConfig(){
            var be=this;
            await be.inTransaction({} as Request, async function(client:Client){
                //TODO deshardcodear 'REPSIC' recorrer todos los operativos
                be.defEstructural = await be.armarDefEstructural(client, 'REPSIC');
            });
            await super.postConfig();
        }

        async generateBaseTableDef(client: Client, tablaDatos:TablaDatos){
            let td = await super.generateBaseTableDef(client, tablaDatos);
            //TODO: dejar de preguntar por el postfix agregar un campo "esCalculada" a tablaDatos 
            if (tablaDatos.tipo == tiposTablaDato.calculada){
                let estParaGenTabla:DefinicionEstructuralTabla = this.defEstructural.tables[tablaDatos.unidad_analisis];
                td.foreignKeys = [{ references: estParaGenTabla.sourceBro, fields: estParaGenTabla.pks, onDelete: 'cascade', displayAllFields: true }];
                td.detailTables = estParaGenTabla.detailTables;
                td.sql.isReferable = true;
                td.allow = {...td.allow, insert: true, update: true}
            }
            return td
        }

        async armarDefEstructural(client: Client, operativo: string){
            var sqlParams=[operativo];
            var results={
                aliases: await client.query(
                    `Select alias, (to_jsonb(alias.*)) alias_def_est
                    From alias
                    Where operativo=$1`
                    , sqlParams
                ).fetchAll(),
                tables: await client.query(
                    `SELECT ua.*, to_jsonb(array_agg(v.variable order by v.orden)) pk_arr
                    FROM unidad_analisis ua join variables v on v.operativo=ua.operativo and v.unidad_analisis=ua.unidad_analisis and v.es_pk
                    where ua.operativo=$1
                    group by ua.operativo, ua.unidad_analisis`
                    , sqlParams
                ).fetchAll()
            };
            let defEst: DefinicionEstructural ={
                aliases: {},
                tables: {}
            }
            results.aliases.rows.forEach(function(a:{alias:string, alias_def_est:AliasDefEst}){ defEst.aliases[a.alias]=a.alias_def_est });
            //falta trabajar results para obtener la pinta de  defEst
            results.tables.rows.forEach(function(table: UnidadDeAnalisis & {pk_arr: string[]}){
                let tua = table.unidad_analisis;
                let tDefEst:DefinicionEstructuralTabla = {
                    sourceBro : tua,
                    target: tua + tiposTablaDato.calculada,
                    pks : table.pk_arr,
                    aliasAgg : tua + sufijo_agregacion,
                }
                tDefEst.where = generateConditions(tDefEst.sourceBro, tDefEst.target, table.pk_arr);
                
                tDefEst.whereAgg = {};
                tDefEst.sourceJoin = '';
                if (table.padre){
                    tDefEst.sourceAgg = tDefEst.target + ` inner join ${tua} ON ` + generateConditions(tDefEst.target, tua, table.pk_arr);

                    //calculo pks del padre sacando de la lista completa de pks las agregadas por esta tabla hija
                    let pksPadre: string[] = table.pk_arr.slice(); //copia por valor para no modificar la lista de pks completa
                    table.pk_agregada.split(',').forEach(pkAgregada => {
                        let index = pksPadre.indexOf(pkAgregada);
                        if (index){
                            pksPadre.splice(index, 1);
                        }
                    });
                    // Calculo whereAgg
                    tDefEst.whereAgg[table.padre] = generateConditions(table.padre, tDefEst.target, pksPadre);
                    // Calculo sourceJoin
                    tDefEst.sourceJoin = `inner join ${table.padre} using (${pksPadre.join(', ')})`;
                }else {
                    tDefEst.sourceAgg = tDefEst.target;
                }
                tDefEst.detailTables= [];
                
                defEst.tables[tua] = tDefEst;
            });
            
            //Seteo de detail tables a los padres de las tablas que tienen padre
            results.tables.rows.filter(t => t.padre).forEach(function(table: UnidadDeAnalisis & {pk_arr: string[]}){
                // TODO: completar la tabla hija
                defEst.tables[table.padre].detailTables.push({
                    table: table.unidad_analisis,
                    fields: table.pk_arr,
                    abr: table.unidad_analisis.substr(0,1).toUpperCase()
                });
            });
            return defEst;
        }

        getMenu():operativos.MenuDefinition{
            //TODO: es igual que en datos-ext llevarlo a operativos
            let myMenuPart:operativos.MenuInfo[]=[
                {menuType:'proc', name:'generar_calculadas',label:'generar calculadas', proc:'calculadas/generar'},
                {menuType:'table', name:'alias'},
            ];
            let menu = {menu: super.getMenu().menu.concat(myMenuPart)}
            return menu;
        }
        prepareGetTables(){
            //TODO: es igual que en datos-ext llevarlo a operativos
            super.prepareGetTables();
            this.getTableDefinition={
                ...this.getTableDefinition,
                alias
            }
        }
    }
}

export var AppVarCal = emergeAppVarCal(operativos.emergeAppOperativos(operativos.AppBackend));
export type VarCalType = InstanceType<typeof AppVarCal>;