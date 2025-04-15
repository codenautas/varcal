"use strict";

import * as bg from "best-globals";
import { defConfig } from "./def-config";
import { procedures } from "./procedures-varcal";
import { AppBackend, AppOperativosType, Constructor, emergeAppOperativos, TablaDatos, TableDefinition, TableDefinitions, VarCalculator } from "./types-varcal";
import { Request, OptsClientPage } from "operativos";

// re-export my file of types for external modules
export * from './types-varcal';

export function emergeAppVarCal<T extends Constructor<AppOperativosType>>(Base:T){    
    return class AppVarCal extends Base{

        constructor(...args:any[]){
            super(args);
        }

        configStaticConfig(){
            super.configStaticConfig();
            this.setStaticConfig(defConfig);
        }

        async getProcedures(){
            var parentProc = await super.getProcedures()
            return parentProc.concat(procedures);
        }

        clientIncludes(req:Request, hideBEPlusInclusions:OptsClientPage){
            return super.clientIncludes(req, hideBEPlusInclusions).concat([
                {type:'js', module: 'varcal', modPath: '../client', file: 'varcal.js', path: 'client_modules'}
            ])
        }

        generateAndLoadTableDefs(){
            let varCalculator = <VarCalculator> VarCalculator.instanceObj;
            let tableDefs: TableDefinitions={};
            let tdCalculadas = varCalculator.getTDCalculadas();
            tdCalculadas.forEach(tablaDato => {
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
                // TODO: ver si hay que sacar el td_base del fetchall y fetch one de tabla_datos
                tDef.foreignKeys = [{ references: tablaDatos.td_base, fields: tablaDatos.pks, onDelete: 'cascade', displayAllFields: true }];
                // tDef.detailTables = estParaGenTabla.detailTables;
                if (tDef.sql){
                    tDef.sql.isReferable = true;
                }
            }
            return tDef
        }

        prepareGetTables(){
            super.prepareGetTables();
            this.appendToTableDefinition('operativos', function(tableDef){
                tableDef.fields.push(
                    {name: "calcular" , typeName: "bigint"  , editable:false, clientSide:'generarCalculadas', title:'re-generar var-cals', label:'si se modificó la definición de alguna var-cal'},
                    {name: 'calculada' , typeName:'timestamp', editable:true, title:'fecha calculo var-cals'},
                );
            });
        }
    }
}

export var AppVarCal = emergeAppVarCal(emergeAppOperativos(AppBackend));
export type AppVarCalType = InstanceType<typeof AppVarCal>;