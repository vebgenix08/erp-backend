"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionUseCase = getSessionUseCase;
const session_service_1 = require("../session.service");
async function getSessionUseCase(context, deps) {
    return (0, session_service_1.getSession)(context, deps);
}
