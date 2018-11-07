"use strict";

import * as bg from "best-globals";
import * as operativos from "operativos";
import { TablaDatos, TableDefinition, TableDefinitions } from "operativos";
import { procedures } from "./procedures-varcal";
import { VarCalculator } from "./types-varcal";

// re-export my file of types for external modules
export * from './types-varcal';

export function emergeAppVarCal<T extends operativos.Constructor<operativos.AppOperativosType>>(Base:T){    
    return class AppVarCal extends Base{

        constructor(...args:any[]){
            super(args);
            this.allProcedures = this.allProcedures.concat(procedures);
            this.allClientFileNames.push({type:'js', module: 'varcal', modPath: '../client', file: 'varcal.js', path: 'client_modules'})
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
    }
}

export var AppVarCal = emergeAppVarCal(operativos.emergeAppOperativos(operativos.AppBackend));
export type AppVarCalType = InstanceType<typeof AppVarCal>;