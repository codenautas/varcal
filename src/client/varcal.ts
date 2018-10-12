'use strict';

import {html} from "js-to-html";
import * as myOwn from "myOwn";
import { TablaDatos } from "operativos";

myOwn.clientSides.verTabla = {
    prepare: function (depot:myOwn.Depot, fieldName: string) {
        //TODO sacar hardcode "calculada" (requiere importar operativos en cliente)
        let tabla_datos = <TablaDatos & {estructura_cerrada: string}> depot.row;
        if (tabla_datos.tipo == 'calculada' || tabla_datos.estructura_cerrada){
            var link = html.a().create();
            var td = depot.rowControls[fieldName];
            // TODO: se debería poder usar método de instancia getTableName pero desde el navegador no funciona
            // link.href='#w=table&table=' + TablaDatos.construirConObj(tabla_datos).getTableName();
            link.href='#w=table&table=' + tabla_datos.operativo.toLowerCase() + '_' + tabla_datos.tabla_datos;;
            link.textContent='ir a tabla';
            td.appendChild(link);
        }
    }
}

function botonClientSideEnGrilla(opts: {nombreBoton: string, llamada: (depot:myOwn.Depot)=> Promise<any>}){
    return {
        prepare: function (depot:myOwn.Depot, fieldName: string) {
            var td = depot.rowControls[fieldName];
            var boton = html.button(opts.nombreBoton).create();
            td.innerHTML = "";
            td.appendChild(boton);
            var restaurarBoton = function(){
                boton.disabled=false;
                boton.textContent=opts.nombreBoton;
                boton.style.backgroundColor='';
            }
            boton.onclick=function(){
                boton.disabled=true;
                boton.textContent='procesando...';
                opts.llamada(depot).then(function(result){
                    boton.textContent='¡listo!';
                    boton.title=result;
                    boton.style.backgroundColor='#8F8';
                    var grid=depot.manager;
                    grid.retrieveRowAndRefresh(depot).then(function(){
                        // setTimeout(restaurarBoton,3000);
                    },function(){
                        // setTimeout(restaurarBoton,3000);
                    })
                }, function(err){
                    boton.textContent='error';
                    boton.style.backgroundColor='#FF8';
                    alertPromise(err.message).then(restaurarBoton,restaurarBoton);
                })
            }
        }
    };
}
myOwn.clientSides.generarCalculadas = botonClientSideEnGrilla({
    nombreBoton:'generar',
    llamada:function(depot: myOwn.Depot){
        return myOwn.ajax.calculadas.generar({operativo: depot.row.operativo});
    }
});