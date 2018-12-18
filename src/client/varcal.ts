'use strict';

import {html} from "js-to-html";
import * as myOwn from "myOwn";
import { TablaDatos } from "operativos";

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
    nombreBoton:'calcular',
    llamada:function(depot: myOwn.Depot){
        return myOwn.ajax.calculadas.generar({operativo: depot.row.operativo});
    }
});
