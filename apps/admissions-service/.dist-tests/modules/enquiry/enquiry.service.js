"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEnquiry = createEnquiry;
exports.getEnquiry = getEnquiry;
exports.listEnquiries = listEnquiries;
exports.updateEnquiry = updateEnquiry;
exports.closeEnquiry = closeEnquiry;
const errors_1 = require("@school-erp/errors");
const auth_1 = require("@school-erp/auth");
const tenancy_1 = require("@school-erp/tenancy");
const enquiry_permissions_1 = require("./enquiry.permissions");
const enquiry_mapper_1 = require("./enquiry.mapper");
const enquiry_repository_1 = require("./enquiry.repository");
const enquiry_validator_1 = require("./enquiry.validator");
function resolveRepository(deps) {
    return deps?.repository ?? enquiry_repository_1.enquiryRepository;
}
function resolveLogger(deps) {
    return deps?.logger;
}
function getTenantId(context) {
    return (0, tenancy_1.requireTenantId)(context.tenantContext);
}
function getActorId(context) {
    const auth = (0, auth_1.requireAuth)(context.authContext);
    const userId = auth.user?.id?.trim();
    if (!userId) {
        throw new errors_1.BadRequestError("authenticated user id is required");
    }
    return userId;
}
function assertPermission(context, permission) {
    (0, auth_1.requirePermission)(context.authContext, permission);
}
function log(deps, message, context) {
    const logger = resolveLogger(deps);
    if (!logger)
        return;
    logger.withContext({
        requestId: context.requestId,
        tenantId: context.tenantContext.tenantId,
        userId: context.authContext.user?.id,
    }).info(message);
}
function formatEnquiryNumber(sequence) {
    return `ENQ-${String(sequence).padStart(4, "0")}`;
}
async function createEnquiry(input, context, deps) {
    assertPermission(context, enquiry_permissions_1.enquiryPermissions.create);
    const repository = resolveRepository(deps);
    const tenantId = getTenantId(context);
    const payload = (0, enquiry_validator_1.validateEnquiryCreateInput)(input);
    const sequence = await repository.nextEnquirySequence(tenantId);
    const enquiryNumber = formatEnquiryNumber(sequence);
    const now = new Date();
    const createdBy = getActorId(context);
    const record = await repository.create(tenantId, {
        ...payload,
        enquiryNumber,
        createdBy,
        status: "NEW",
        createdAt: now,
        updatedAt: now,
    });
    log(deps, `enquiry.created:${record.enquiryNumber}`, context);
    return (0, enquiry_mapper_1.toEnquiryView)(record);
}
async function getEnquiry(id, context, deps) {
    assertPermission(context, enquiry_permissions_1.enquiryPermissions.read);
    const repository = resolveRepository(deps);
    const tenantId = getTenantId(context);
    const enquiry = await repository.getById(tenantId, id);
    return (0, enquiry_mapper_1.toEnquiryView)(enquiry);
}
async function listEnquiries(context, deps, filter) {
    assertPermission(context, enquiry_permissions_1.enquiryPermissions.read);
    const repository = resolveRepository(deps);
    const tenantId = getTenantId(context);
    const enquiries = await repository.list(tenantId, (0, enquiry_validator_1.validateEnquiryListFilter)(filter));
    return enquiries.map((enquiry) => (0, enquiry_mapper_1.toEnquiryView)(enquiry));
}
async function updateEnquiry(id, input, context, deps) {
    assertPermission(context, enquiry_permissions_1.enquiryPermissions.update);
    const repository = resolveRepository(deps);
    const tenantId = getTenantId(context);
    const existing = await repository.getById(tenantId, id);
    if (!existing) {
        return null;
    }
    if (existing.status === "CLOSED") {
        throw new errors_1.ConflictError("closed enquiries cannot be updated");
    }
    const payload = (0, enquiry_validator_1.validateEnquiryUpdateInput)(input);
    const updated = await repository.update(tenantId, id, {
        ...payload,
        updatedAt: new Date(),
    });
    log(deps, `enquiry.updated:${existing.enquiryNumber}`, context);
    return (0, enquiry_mapper_1.toEnquiryView)(updated);
}
async function closeEnquiry(id, context, deps) {
    assertPermission(context, enquiry_permissions_1.enquiryPermissions.close);
    const repository = resolveRepository(deps);
    const tenantId = getTenantId(context);
    const existing = await repository.getById(tenantId, id);
    if (!existing) {
        return null;
    }
    if (existing.status === "CLOSED") {
        return (0, enquiry_mapper_1.toEnquiryView)(existing);
    }
    const now = new Date();
    const closed = await repository.close(tenantId, id, {
        status: "CLOSED",
        closedAt: now,
        updatedAt: now,
    });
    log(deps, `enquiry.closed:${existing.enquiryNumber}`, context);
    return (0, enquiry_mapper_1.toEnquiryView)(closed);
}
