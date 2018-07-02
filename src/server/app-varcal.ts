"use strict";

import * as operativos from "operativos";
import {AppOperativos} from "operativos";

import {ProceduresVarCal} from "./procedures-varcal";
import { alias } from "./table-alias";

export * from './types-varcal';
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
        clientIncludes(req:operativos.Request, hideBEPlusInclusions:boolean){
            //TODO: es igual que en datos-ext llevarlo a operativos
            return super.clientIncludes(req, hideBEPlusInclusions).concat([
                {type:'js' , src:'client/varcal.js'},
            ])
        }
        getMenu():operativos.MenuDefinition{
            //TODO: es igual que en datos-ext llevarlo a operativos
            let myMenuPart:operativos.MenuInfo[]=[
                {menuType:'proc', name:'generar_calculadas',label:'Generar Calculadas', proc:'calculadas/generar'},
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