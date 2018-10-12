"use strict";

import * as operativos from "operativos";

import { procedures } from "./procedures-varcal";
import { alias } from "./table-alias";
import { Client } from "pg-promise-strict";
import { TablaDatos, UnidadDeAnalisis, Request, tiposTablaDato, Operativo, TablaDatosDB } from "operativos";
import { buildONClausule, sufijo_agregacion } from "./var-cal";
import { AliasDefEst, DefinicionEstructural, DefinicionEstructuralTabla} from "./types-varcal";

// re-export my file of types for external modules
export * from './types-varcal';

export type Constructor<T> = new(...args: any[]) => T;

export function emergeAppVarCal<T extends Constructor<operativos.AppOperativosType>>(Base:T){    
    return class AppVarCal extends Base{
        defEsts:{[key:string]: DefinicionEstructural} = {};
        myProcedures: operativos.ProcedureDef[] = procedures;
        myClientFileName: string = 'varcal';

        constructor(...args:any[]){
            super(args);
            this.initialize();
        }

        async postConfig(){
            await super.postConfig();
            var be=this;
            await be.inTransaction({} as Request, async function(client:Client){
                let operativos = await client.query('SELECT * from operativos').fetchAll();
                await Promise.all(operativos.rows.map((ope: Operativo) => be.armarDefEstructural(client, ope.operativo)));
            });
        }

        async generateBaseTableDef(client: Client, tablaDatosDB:TablaDatosDB){
            let tablaDatos = TablaDatos.construirConObj(tablaDatosDB);
            let tDef = await super.generateBaseTableDef(client, tablaDatos);
            //TODO: dejar de preguntar por el postfix agregar un campo "esCalculada" a tablaDatos 
            if (tablaDatos.esCalculada()){
                let estParaGenTabla:DefinicionEstructuralTabla = this.defEsts[tablaDatos.operativo].tables[tablaDatos.unidad_analisis];
                // esto se agrega para que las calculadas muestren también todos los campos de su sourceBro
                tDef.foreignKeys = [{ references: estParaGenTabla.sourceBro, fields: estParaGenTabla.pks, onDelete: 'cascade', displayAllFields: true }];
                tDef.detailTables = estParaGenTabla.detailTables;
                tDef.sql.isReferable = true;
            }
            return tDef
        }

        static sufijarCalculada(str:string){
            // sufija la UA Calculada
            return str + '_' + tiposTablaDato.calculada;
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
                    FROM unidad_analisis ua JOIN tabla_datos td ON ua.operativo = td.operativo AND ua.unidad_analisis = td.unidad_analisis JOIN variables v on v.operativo=ua.operativo and v.tabla_datos=td.tabla_datos and v.es_pk
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
            results.tables.rows.forEach(function(table: UnidadDeAnalisis & TablaDatos & {pk_arr: string[]}){
                let tua = table.operativo.toLowerCase() + '_' + table.unidad_analisis;
                let tDefEst:DefinicionEstructuralTabla = {
                    operativo: operativo,
                    sourceBro :  tua,
                    target: AppVarCal.sufijarCalculada(tua),                    
                    pks : table.pk_arr,
                    aliasAgg : tua + sufijo_agregacion,
                }
                tDefEst.where = buildONClausule(tDefEst.sourceBro, tDefEst.target, table.pk_arr);
                
                tDefEst.whereAgg = {};
                tDefEst.sourceJoin = '';
                if (table.padre){
                    tDefEst.sourceAgg = tDefEst.target + ` inner join ${tDefEst.sourceBro} ON ` + buildONClausule(tDefEst.target, tDefEst.sourceBro, table.pk_arr);
                    let padrePrefijado = table.operativo.toLowerCase() + '_' + table.padre;
                    //calculo pks del padre sacando de la lista completa de pks las agregadas por esta tabla hija
                    let pksPadre: string[] = table.pk_arr.slice(); //copia por valor para no modificar la lista de pks completa
                    table.pk_agregada.split(',').forEach(pkAgregada => {
                        let index = pksPadre.indexOf(pkAgregada);
                        if (index > -1){
                            pksPadre.splice(index, 1);
                        }
                    });
                    // Calculo whereAgg
                    tDefEst.whereAgg[table.padre] = buildONClausule(padrePrefijado, tDefEst.target, pksPadre);
                    // Calculo sourceJoin
                    tDefEst.sourceJoin = `inner join ${padrePrefijado} using (${pksPadre.join(', ')})`;
                }else {
                    tDefEst.sourceAgg = tDefEst.target;
                }
                tDefEst.detailTables= [];
                
                defEst.tables[table.unidad_analisis] = tDefEst;
            });
            
            //Seteo de detail tables a los padres de las tablas que tienen padre, se hace por separado para que todos los padres ya esten completos
            results.tables.rows.filter(t => t.padre).forEach(function(table: UnidadDeAnalisis & {pk_arr: string[]}){
                // se agregan como detalles ambas tablas la calculada (puede no existir) y la tabla datos
                defEst.tables[table.padre].detailTables.push({
                    table: table.unidad_analisis,
                    fields: defEst.tables[table.padre].pks,
                    abr: table.unidad_analisis.substr(0,1).toUpperCase()
                });
                defEst.tables[table.padre].detailTables.push({
                    table: AppVarCal.sufijarCalculada(table.unidad_analisis),
                    fields: defEst.tables[table.padre].pks,
                    abr: table.unidad_analisis.substr(0,1).toUpperCase() + '-C'
                });
            });
            this.defEsts[operativo] = defEst;
        }

        getMenu():operativos.MenuDefinition{
            //TODO: es igual que en datos-ext llevarlo a operativos
            let myMenuPart:operativos.MenuInfo[]=[
                {menuType:'proc', name:'generar_calculadas',label:'generar calculadas', proc:'calculadas/generar'},
                {menuType:'table', name:'relaciones',table:'alias'},
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
            this.appendToTableDefinition('operativos', function(tableDef){
                tableDef.fields.push(
                    {name:'calculada', typeName:'date', editable:true}
                );
            });
        }
    }
}

export var AppVarCal = emergeAppVarCal(operativos.emergeAppOperativos(operativos.AppBackend));
export type VarCalType = InstanceType<typeof AppVarCal>;