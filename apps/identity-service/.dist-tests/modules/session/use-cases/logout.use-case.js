"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoutUseCase = logoutUseCase;
const session_service_1 = require("../session.service");
async function logoutUseCase(context) {
    return (0, session_service_1.logout)(context);
}
