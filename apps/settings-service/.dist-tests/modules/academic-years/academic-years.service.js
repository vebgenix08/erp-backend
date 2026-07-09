"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAcademicYears = listAcademicYears;
exports.getAcademicYear = getAcademicYear;
exports.createAcademicYear = createAcademicYear;
exports.updateAcademicYear = updateAcademicYear;
exports.activateAcademicYear = activateAcademicYear;
const auth_1 = require("@school-erp/auth");
const errors_1 = require("@school-erp/errors");
const tenancy_1 = require("@school-erp/tenancy");
const academic_years_permissions_1 = require("./academic-years.permissions");
const academic_years_repository_1 = require("./academic-years.repository");
const academic_years_mapper_1 = require("./academic-years.mapper");
const academic_years_validator_1 = require("./academic-years.validator");
function resolveRepository(deps) {
    return deps?.repository ?? academic_years_repository_1.academicYearRepository;
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
async function listAcademicYears(context, deps, filter) {
    ensure(context, academic_years_permissions_1.academicYearPermissions.read);
    const records = await resolveRepository(deps).list(getTenantId(context), (0, academic_years_validator_1.validateAcademicYearListFilter)(filter));
    return records.map((record) => (0, academic_years_mapper_1.toAcademicYearView)(record));
}
async function getAcademicYear(context, id, deps) {
    ensure(context, academic_years_permissions_1.academicYearPermissions.read);
    return (0, academic_years_mapper_1.toAcademicYearView)(await resolveRepository(deps).getById(getTenantId(context), id));
}
async function createAcademicYear(context, input, deps) {
    ensure(context, academic_years_permissions_1.academicYearPermissions.create);
    const repository = resolveRepository(deps);
    const tenantId = getTenantId(context);
    const payload = (0, academic_years_validator_1.validateAcademicYearCreateInput)(input);
    const duplicate = await repository.getByCode(tenantId, payload.code);
    if (duplicate) {
        throw new errors_1.ConflictError("academic year code must be unique");
    }
    const created = await repository.create(tenantId, payload);
    log(deps, context, `academic-year.created:${created.code}`);
    return (0, academic_years_mapper_1.toAcademicYearView)(created);
}
async function updateAcademicYear(context, id, input, deps) {
    ensure(context, academic_years_permissions_1.academicYearPermissions.update);
    const repository = resolveRepository(deps);
    const tenantId = getTenantId(context);
    const existing = await repository.getById(tenantId, id);
    if (!existing)
        return null;
    const payload = (0, academic_years_validator_1.validateAcademicYearUpdateInput)(input);
    if (payload.code) {
        const duplicate = await repository.getByCode(tenantId, payload.code);
        if (duplicate && duplicate.id !== id) {
            throw new errors_1.ConflictError("academic year code must be unique");
        }
    }
    const updated = await repository.update(tenantId, id, payload);
    log(deps, context, `academic-year.updated:${existing.code}`);
    return (0, academic_years_mapper_1.toAcademicYearView)(updated);
}
async function activateAcademicYear(context, id, deps) {
    ensure(context, academic_years_permissions_1.academicYearPermissions.activate);
    const repository = resolveRepository(deps);
    const tenantId = getTenantId(context);
    const existing = await repository.getById(tenantId, id);
    if (!existing)
        return null;
    const updated = await repository.activate(tenantId, id);
    log(deps, context, `academic-year.activated:${existing.code}`);
    return (0, academic_years_mapper_1.toAcademicYearView)(updated);
}
