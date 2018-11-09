"use strict";

import * as bg from "best-globals";
import * as typesVarcal from './types-varcal';
import { procedures } from "./procedures-varcal";
import { VarCalculator } from "./types-varcal";
import { MenuDefinition } from "operativos";

// re-export my file of types for external modules
export * from './types-varcal';
export * from './var-cal';

export function emergeAppVarCal<T extends typesVarcal.Constructor<typesVarcal.AppOperativosType>>(Base:T){    
    return class AppVarCal extends Base{

        constructor(...args:any[]){
            super(args);
            this.allProcedures = this.allProcedures.concat(procedures);
            this.allClientFileNames.push({type:'js', module: 'varcal', modPath: '../client', file: 'varcal.js', path: 'client_modules'})
        }

        configStaticConfig():void{
            super.configStaticConfig();
        }

        generateAndLoadTableDefs(){
            let varCalculator = <VarCalculator> VarCalculator.instanceObj;
            let tableDefs: typesVarcal.TableDefinitions={};
            let calcTDatos = varCalculator.getTDCalculadas();
            calcTDatos.forEach(tablaDato => {
                let tdef:typesVarcal.TableDefinition = this.generateBaseTableDef(tablaDato);
                this.loadTableDef(tdef); //carga el tableDef para las grillas (las grillas de calculadas NO deben permitir insert o update)
                let newTDef = bg.changing(tdef, {allow: {insert: true, update: true}}); // modifica los allows para el dumpSchemaPartial (necesita insert y update)
                tableDefs[newTDef.name] = this.getTableDefFunction(newTDef);
            });
            return tableDefs
        }

        generateBaseTableDef(tablaDatos:typesVarcal.TablaDatos){
            let tDef = super.generateBaseTableDef(tablaDatos);
            if (tablaDatos.esCalculada()){
                // esto se agrega para que las calculadas muestren también todos los campos de su sourceBro
                tDef.foreignKeys = [{ references: tablaDatos.getPrefixedQueBusco(), fields: tablaDatos.pks, onDelete: 'cascade', displayAllFields: true }];
                // tDef.detailTables = estParaGenTabla.detailTables;
                tDef.sql.isReferable = true;
            }
            return tDef
        }

        prepareGetTables(){
            super.prepareGetTables();
            this.appendToTableDefinition('operativos', function(tableDef){
                tableDef.fields.push(
                    {name: "calcular" , typeName: "bigint"  , editable:false, clientSide:'generarCalculadas'},
                    {name: 'calculada' , typeName:'date', editable:true},
                );
            });
        }
        getMenu():MenuDefinition{
            return {menu: super.getMenu().menu}
        }
    }
}

export var AppVarCal = emergeAppVarCal(typesVarcal.emergeAppOperativos(typesVarcal.AppBackend));
export type AppVarCalType = InstanceType<typeof AppVarCal>;