"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantUseCase = getTenantUseCase;
const tenants_service_1 = require("../tenants.service");
async function getTenantUseCase(id, deps) {
    return (0, tenants_service_1.getTenant)(id, deps);
}
