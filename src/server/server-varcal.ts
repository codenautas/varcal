"use strict";

import {emergeAppVarCal} from "./app-varcal"
import {emergeAppOperativos} from "operativos"
import { AppBackend } from "backend-plus"

var AppVarCal = emergeAppVarCal(emergeAppOperativos(AppBackend));

new AppVarCal().start();