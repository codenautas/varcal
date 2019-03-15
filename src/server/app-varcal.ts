"use strict";

import * as bg from "best-globals";
import { procedures } from "./procedures-varcal";
import { VarCalculator, Constructor, AppOperativosType, TableDefinitions, TableDefinition, TablaDatos,
         emergeAppOperativos, AppBackend
} from "./types-varcal";
import { MenuDefinition } from "operativos";

// re-export my file of types for external modules
export * from './types-varcal';
export * from './var-cal';

export function emergeAppVarCal<T extends Constructor<AppOperativosType>>(Base:T){    
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
            let tableDefs: TableDefinitions={};
            let calcTDatos = varCalculator.getTDCalculadas();
            calcTDatos.forEach(tablaDato => {
                let tdef:TableDefinition = this.generateBaseTableDef(tablaDato);
                this.loadTableDef(tdef); //carga el tableDef para las grillas (las grillas de calculadas NO deben permitir insert o update)
                let newTDef = bg.changing(tdef, {allow: {insert: true, update: true}}); // modifica los allows para el dumpSchemaPartial (necesita insert y update)
                tableDefs[newTDef.name] = this.getTableDefFunction(newTDef);
            });
            return tableDefs
        }

        generateBaseTableDef(tablaDatos:TablaDatos){
            let tDef = super.generateBaseTableDef(tablaDatos);
            if (tablaDatos.esCalculada()){
                // esto se agrega para que las calculadas muestren también todos los campos de su sourceBro
                // TODO: ver si hay que sacar el que_busco del fetchall y fetch one de tabla_datos               
                tDef.foreignKeys = [{ references: tablaDatos.que_busco, fields: tablaDatos.pks, onDelete: 'cascade', displayAllFields: true }];
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
                    {name: 'calculada' , typeName:'timestamp', editable:true},
                );
            });
        }
        getMenu():MenuDefinition{
            return {menu: super.getMenu().menu}
        }
    }
}

export var AppVarCal = emergeAppVarCal(emergeAppOperativos(AppBackend));
export type AppVarCalType = InstanceType<typeof AppVarCal>;