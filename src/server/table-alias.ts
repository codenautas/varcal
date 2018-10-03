"use strict";

import {TableContext,TableDefinition} from "operativos"

export function alias(context:TableContext):TableDefinition{
    var admin=context.user.rol==='admin';
    return {
        name:'alias',
        elementName:'alias',
        title:'relaciones',
        editable:admin,
        fields:[
            {name:"operativo"     , typeName:'text'  ,              },
            {name:"alias"         , typeName:'text'  ,title:'relación'              },
            {name:"tabla_datos"   , typeName:'text'  ,nullable:false},
            {name:"on"            , typeName:'text'  ,nullable:false},
            {name:"where"         , typeName:'text'                 },
            {name:"descripcion"   , typeName:'text'  ,              },
        ],
        primaryKey:['operativo', 'alias'],
        foreignKeys:[
            {references:'operativos' , fields:['operativo']},
            {references:'tabla_datos', fields:['operativo','tabla_datos']},
        ],        
    };
}