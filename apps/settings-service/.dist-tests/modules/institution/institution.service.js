"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInstitutionProfile = getInstitutionProfile;
exports.updateInstitutionProfile = updateInstitutionProfile;
const auth_1 = require("@school-erp/auth");
const tenancy_1 = require("@school-erp/tenancy");
const institution_permissions_1 = require("./institution.permissions");
const institution_mapper_1 = require("./institution.mapper");
const institution_repository_1 = require("./institution.repository");
const institution_validator_1 = require("./institution.validator");
function resolveRepository(deps) {
    return deps?.repository ?? institution_repository_1.institutionRepository;
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
function getTenantId(context) {
    return (0, tenancy_1.requireTenantId)(context.tenantContext);
}
function requireActor(context) {
    (0, auth_1.requireAuth)(context.authContext);
}
async function getInstitutionProfile(context, deps) {
    requireActor(context);
    (0, auth_1.requirePermission)(context.authContext, institution_permissions_1.institutionPermissions.read);
    const record = await resolveRepository(deps).getById(getTenantId(context), "institution");
    return (0, institution_mapper_1.toInstitutionProfileView)(record);
}
async function updateInstitutionProfile(input, context, deps) {
    requireActor(context);
    (0, auth_1.requirePermission)(context.authContext, institution_permissions_1.institutionPermissions.update);
    const repository = resolveRepository(deps);
    const tenantId = getTenantId(context);
    const payload = (0, institution_validator_1.validateInstitutionProfileUpdateInput)(input);
    const existing = await repository.getById(tenantId, "institution");
    const updated = existing
        ? await repository.update(tenantId, "institution", payload)
        : await repository.create(tenantId, (0, institution_validator_1.validateInstitutionProfileInput)({ ...payload, name: payload.name ?? "Institution" }));
    log(deps, context, "institution.profile.updated");
    return (0, institution_mapper_1.toInstitutionProfileView)(updated);
}
