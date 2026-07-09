"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTenantUseCase = createTenantUseCase;
const tenants_service_1 = require("../tenants.service");
async function createTenantUseCase(input, deps) {
    return (0, tenants_service_1.createTenant)(input, deps);
}
