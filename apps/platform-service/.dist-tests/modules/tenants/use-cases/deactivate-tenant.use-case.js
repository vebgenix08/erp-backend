"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivateTenantUseCase = deactivateTenantUseCase;
const tenants_service_1 = require("../tenants.service");
async function deactivateTenantUseCase(id, deps) {
    return (0, tenants_service_1.deactivateTenant)(id, deps);
}
