"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTenantUseCase = updateTenantUseCase;
const tenants_service_1 = require("../tenants.service");
async function updateTenantUseCase(id, input, deps) {
    return (0, tenants_service_1.updateTenant)(id, input, deps);
}
