'use strict';

import {html} from "js-to-html";
import * as myOwn from "myOwn";

myOwn.clientSides.verTabla = {
    prepare: function (depot:myOwn.Depot, fieldName: string) {
        //TODO sacar hardcode "calculada" (requiere importar operativos en cliente)
        if (depot.row.tipo == 'calculada' || depot.row.estructura_cerrada){
            var link = html.a().create();
            var td = depot.rowControls[fieldName];
            link.href='#w=table&table=' + depot.row.tabla_datos;
            link.textContent='ir a tabla';
            td.appendChild(link);
        }
    }
}