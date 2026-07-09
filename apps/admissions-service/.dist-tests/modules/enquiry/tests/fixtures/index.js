"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEnquiryServiceContext = createEnquiryServiceContext;
exports.createEnquiryInput = createEnquiryInput;
const auth_1 = require("@school-erp/auth");
const tenancy_1 = require("@school-erp/tenancy");
function createEnquiryServiceContext(overrides = {}) {
    const request = {
        requestId: overrides.requestId ?? "req_test_1",
        headers: {
            "x-user-id": overrides.userId ?? "user_test_1",
            "x-user-permissions": overrides.permissions ?? "admissions.enquiry.read admissions.enquiry.create admissions.enquiry.update admissions.enquiry.close",
            "x-tenant-id": overrides.tenantId ?? "tenant_test_1",
        },
    };
    return {
        tenantContext: (0, tenancy_1.resolveTenantFromRequest)(request),
        authContext: (0, auth_1.resolveAuthFromRequest)(request),
        requestId: request.requestId,
    };
}
function createEnquiryInput(overrides = {}) {
    return {
        studentName: "Alice Example",
        parentName: "Parent Example",
        phone: "+1 555 0100",
        source: "Walk-in",
        ...overrides,
    };
}
