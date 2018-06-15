"use strict";

import {emergeAppVarCal} from "./app-varcal"
import {emergeAppOperativos, AppBackend} from "operativos"

var AppVarCal = emergeAppVarCal(emergeAppOperativos(AppBackend));
new AppVarCal().start();