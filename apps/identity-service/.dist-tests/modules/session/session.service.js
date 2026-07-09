"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSession = getSession;
exports.selectTenant = selectTenant;
exports.logout = logout;
const auth_1 = require("@school-erp/auth");
const tenancy_1 = require("@school-erp/tenancy");
const session_repository_1 = require("./session.repository");
const session_mapper_1 = require("./session.mapper");
const session_validator_1 = require("./session.validator");
function resolveRepository(deps) {
    return deps?.repository ?? session_repository_1.sessionRepository;
}
async function getSession(context, deps) {
    const auth = (0, auth_1.requireAuth)(context.authContext);
    const user = auth.user;
    if (!user) {
        throw new Error("auth user is required");
    }
    const selectedTenant = await resolveRepository(deps).getSelectedTenant(user.id);
    return (0, session_mapper_1.toSessionPayload)(auth, selectedTenant);
}
async function selectTenant(input, context, deps) {
    const auth = (0, auth_1.requireAuth)(context.authContext);
    const user = auth.user;
    if (!user) {
        throw new Error("auth user is required");
    }
    const payload = (0, session_validator_1.validateSelectTenantInput)(input);
    const tenantContext = payload.tenantId
        ? (0, tenancy_1.createTenantContext)({ tenantId: payload.tenantId, source: "request" })
        : (0, tenancy_1.createTenantContext)({ tenantCode: payload.tenantCode, source: "request" });
    const selectedTenant = (0, session_mapper_1.toSessionTenantSnapshot)(tenantContext);
    if (!selectedTenant) {
        throw new Error("tenant selection failed");
    }
    await resolveRepository(deps).saveSelectedTenant(user.id, selectedTenant);
    return (0, session_mapper_1.toSessionPayload)(auth, selectedTenant);
}
async function logout(context) {
    void (0, auth_1.requireAuth)(context.authContext);
    return { success: true };
}
