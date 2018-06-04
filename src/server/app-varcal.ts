"use strict";

import {Request} from "backend-plus";
import * as backendPlus from "backend-plus";
// tslint:disable TS6133
import * as pgPromise from "pg-promise-strict";
// tslint:disable-next-line:TS6133.
import * as express from "express";
import {ProceduresVarCal} from "./procedures-varcal";
import {AppOperativos, TableContext} from "operativos";


// interface Context extends backendPlus.Context{
//     puede:object
//     superuser?:true
// }

type MenuInfoMapa = {
    menuType:'mapa'
    name:string
};

type MenuInfo = backendPlus.MenuInfo | MenuInfoMapa;

export type Constructor<T> = new(...args: any[]) => T;

export function emergeAppVarCal<T extends Constructor<InstanceType<typeof AppOperativos>>>(Base:T){
    
    return class AppVarCal extends Base{
        constructor(...args:any[]){ 
            super(...args);
        }
        getProcedures(){
            var be = this;
            return super.getProcedures().then(function(procedures){
                return procedures.concat(
                    ProceduresVarCal.map(be.procedureDefCompleter, be)
                );
            });
        }    
        clientIncludes(req:Request, hideBEPlusInclusions:boolean){
            return super.clientIncludes(req, hideBEPlusInclusions).concat([
                {type:'js' , src:'client/varcal.js'},
            ])
        }
        getMenu():backendPlus.MenuDefinition{
            let myMenuPart:MenuInfo[]=[
                {menuType:'proc', name:'generar', proc:'origenes/generar'},
            ];
            let menu = {menu: super.getMenu().menu.concat(myMenuPart)}
            return menu;
        }
        prepareGetTables(){
            super.prepareGetTables();
            this.getTableDefinition={
                ...this.getTableDefinition,
                // origenes,
                // variables,
                // variables_opciones
            }
            this.appendToTableDefinition('parametros', function(tableDef){
                tableDef.fields.push(
                    {name:'esquema_tablas_externas', typeName:'text', defaultValue:'ext', editable:false}
                );
            });
            this.appendToTableDefinition('tabla_datos', function(tableDef){
                console.log(tableDef)
                tableDef.fields.push(
                    {name:'estructura_cerrada', typeName:'boolean', editable:false}
                );
                tableDef.constraints.push(
                    {consName:'estructura_cerrada true/null', constraintType:'check', expr:'estructura_cerrada is true'}
                );
            });
        }
    }
}