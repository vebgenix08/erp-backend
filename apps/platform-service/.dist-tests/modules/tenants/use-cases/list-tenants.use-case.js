"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTenantsUseCase = listTenantsUseCase;
const tenants_service_1 = require("../tenants.service");
async function listTenantsUseCase(deps) {
    return (0, tenants_service_1.listTenants)(deps);
}
