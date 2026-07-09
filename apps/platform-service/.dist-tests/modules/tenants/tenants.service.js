"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTenants = listTenants;
exports.getTenant = getTenant;
exports.createTenant = createTenant;
exports.updateTenant = updateTenant;
exports.deactivateTenant = deactivateTenant;
const errors_1 = require("@school-erp/errors");
const tenants_repository_1 = require("./tenants.repository");
const tenants_mapper_1 = require("./tenants.mapper");
const tenants_validator_1 = require("./tenants.validator");
function resolveRepository(deps) {
    return deps?.repository ?? tenants_repository_1.tenantRepository;
}
async function listTenants(deps) {
    const repository = resolveRepository(deps);
    const tenants = await repository.list();
    return tenants.map((tenant) => (0, tenants_mapper_1.toTenantView)(tenant));
}
async function getTenant(id, deps) {
    const repository = resolveRepository(deps);
    const tenant = await repository.getById(id);
    if (!tenant)
        return null;
    return (0, tenants_mapper_1.toTenantView)(tenant);
}
async function createTenant(input, deps) {
    const repository = resolveRepository(deps);
    const payload = (0, tenants_validator_1.validateTenantCreateInput)(input);
    const existing = await repository.getByCode(payload.code);
    if (existing) {
        throw new errors_1.ConflictError("tenant code must be unique");
    }
    return (0, tenants_mapper_1.toTenantView)(await repository.create(payload));
}
async function updateTenant(id, input, deps) {
    const repository = resolveRepository(deps);
    const payload = (0, tenants_validator_1.validateTenantUpdateInput)(input);
    if (payload.code) {
        const existing = await repository.getByCode(payload.code);
        if (existing && existing.id !== id) {
            throw new errors_1.ConflictError("tenant code must be unique");
        }
    }
    const updated = await repository.update(id, payload);
    if (!updated)
        return null;
    return (0, tenants_mapper_1.toTenantView)(updated);
}
async function deactivateTenant(id, deps) {
    const repository = resolveRepository(deps);
    const existing = await repository.getById(id);
    if (!existing)
        return null;
    if (existing.status === "INACTIVE")
        return (0, tenants_mapper_1.toTenantView)(existing);
    return (0, tenants_mapper_1.toTenantView)(await repository.update(id, { status: "INACTIVE", deactivatedAt: new Date() }));
}
