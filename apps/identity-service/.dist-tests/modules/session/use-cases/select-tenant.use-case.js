"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectTenantUseCase = selectTenantUseCase;
const session_service_1 = require("../session.service");
async function selectTenantUseCase(input, context, deps) {
    return (0, session_service_1.selectTenant)(input, context, deps);
}
