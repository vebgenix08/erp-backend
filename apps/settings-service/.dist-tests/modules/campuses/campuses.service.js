"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCampuses = listCampuses;
exports.getCampus = getCampus;
exports.createCampus = createCampus;
exports.updateCampus = updateCampus;
exports.deactivateCampus = deactivateCampus;
const auth_1 = require("@school-erp/auth");
const errors_1 = require("@school-erp/errors");
const tenancy_1 = require("@school-erp/tenancy");
const campuses_permissions_1 = require("./campuses.permissions");
const campuses_mapper_1 = require("./campuses.mapper");
const campuses_repository_1 = require("./campuses.repository");
const campuses_validator_1 = require("./campuses.validator");
function resolveRepository(deps) {
    return deps?.repository ?? campuses_repository_1.campusRepository;
}
function getTenantId(context) {
    return (0, tenancy_1.requireTenantId)(context.tenantContext);
}
function ensure(context, permission) {
    (0, auth_1.requireAuth)(context.authContext);
    (0, auth_1.requirePermission)(context.authContext, permission);
}
function log(deps, context, message) {
    const logger = deps?.logger;
    if (!logger)
        return;
    logger.withContext({
        requestId: context.requestId,
        tenantId: context.tenantContext?.tenantId,
        userId: context.authContext?.user?.id,
    }).info(message);
}
async function listCampuses(context, deps, filter) {
    ensure(context, campuses_permissions_1.campusPermissions.read);
    const records = await resolveRepository(deps).list(getTenantId(context), (0, campuses_validator_1.validateCampusListFilter)(filter));
    return records.map((record) => (0, campuses_mapper_1.toCampusView)(record));
}
async function getCampus(context, id, deps) {
    ensure(context, campuses_permissions_1.campusPermissions.read);
    return (0, campuses_mapper_1.toCampusView)(await resolveRepository(deps).getById(getTenantId(context), id));
}
async function createCampus(context, input, deps) {
    ensure(context, campuses_permissions_1.campusPermissions.create);
    const repository = resolveRepository(deps);
    const tenantId = getTenantId(context);
    const payload = (0, campuses_validator_1.validateCampusCreateInput)(input);
    const existing = await repository.getByCode(tenantId, payload.code);
    if (existing) {
        throw new errors_1.ConflictError("campus code must be unique");
    }
    const created = await repository.create(tenantId, payload);
    log(deps, context, `campus.created:${created.code}`);
    return (0, campuses_mapper_1.toCampusView)(created);
}
async function updateCampus(context, id, input, deps) {
    ensure(context, campuses_permissions_1.campusPermissions.update);
    const repository = resolveRepository(deps);
    const tenantId = getTenantId(context);
    const existing = await repository.getById(tenantId, id);
    if (!existing)
        return null;
    const payload = (0, campuses_validator_1.validateCampusUpdateInput)(input);
    if (payload.code) {
        const duplicate = await repository.getByCode(tenantId, payload.code);
        if (duplicate && duplicate.id !== id) {
            throw new errors_1.ConflictError("campus code must be unique");
        }
    }
    const updated = await repository.update(tenantId, id, payload);
    log(deps, context, `campus.updated:${existing.code}`);
    return (0, campuses_mapper_1.toCampusView)(updated);
}
async function deactivateCampus(context, id, deps) {
    ensure(context, campuses_permissions_1.campusPermissions.deactivate);
    const repository = resolveRepository(deps);
    const tenantId = getTenantId(context);
    const existing = await repository.getById(tenantId, id);
    if (!existing)
        return null;
    const updated = await repository.deactivate(tenantId, id);
    log(deps, context, `campus.deactivated:${existing.code}`);
    return (0, campuses_mapper_1.toCampusView)(updated);
}
