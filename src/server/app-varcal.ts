"use strict";

import {Request} from "backend-plus";
import * as backendPlus from "backend-plus";
import {ProceduresVarCal} from "./procedures-varcal";
import * as operativos from "operativos";
import {AppOperativos} from "operativos";

//Imports que no deberián estar, los agregamos porque sino tira error
import {TableContext} from "operativos";
// tslint:disable TS6133
import * as pgPromise from "pg-promise-strict";
// tslint:disable-next-line:TS6133.
import * as express from "express";


export type Constructor<T> = new(...args: any[]) => T;

export function emergeAppVarCal<T extends Constructor<InstanceType<typeof AppOperativos>>>(Base:T){
    
    return class AppVarCal extends Base{
        constructor(...args:any[]){ 
            super(...args);
        }
        getProcedures(){
            //TODO: es igual que en datos-ext llevarlo a operativos
            var be = this;
            return super.getProcedures().then(function(procedures){
                return procedures.concat(
                    ProceduresVarCal.map(be.procedureDefCompleter, be)
                );
            });
        }    
        clientIncludes(req:Request, hideBEPlusInclusions:boolean){
            //TODO: es igual que en datos-ext llevarlo a operativos
            return super.clientIncludes(req, hideBEPlusInclusions).concat([
                {type:'js' , src:'client/varcal.js'},
            ])
        }
        getMenu():backendPlus.MenuDefinition{
            //TODO: es igual que en datos-ext llevarlo a operativos
            let myMenuPart:operativos.MenuInfo[]=[
                {menuType:'proc', name:'generar', proc:'origenes/generar'},
            ];
            let menu = {menu: super.getMenu().menu.concat(myMenuPart)}
            return menu;
        }
        prepareGetTables(){
            //TODO: es igual que en datos-ext llevarlo a operativos
            super.prepareGetTables();
            this.getTableDefinition={
                ...this.getTableDefinition,
                // alias
            }
        }
    }
}