"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEnquiryRouter = createEnquiryRouter;
const api_1 = require("@school-erp/api");
const use_cases_1 = require("./use-cases");
const enquiry_validator_1 = require("./enquiry.validator");
function toServiceContext(context) {
    return {
        tenantContext: context.tenantContext,
        authContext: context.authContext,
        requestId: context.requestId,
    };
}
function resolveEnquiryId(context) {
    return context.params.id ?? "";
}
function createEnquiryRouter(router, deps = {}) {
    router.route("POST", "/enquiries", async (context) => {
        const result = await (0, use_cases_1.createEnquiryUseCase)(context.body, toServiceContext(context), deps);
        return (0, api_1.jsonResponse)(201, result);
    });
    router.route("GET", "/enquiries", async (context) => {
        const result = await (0, use_cases_1.listEnquiriesUseCase)(toServiceContext(context), deps, (0, enquiry_validator_1.validateEnquiryListFilter)(context.query));
        return (0, api_1.jsonResponse)(200, result);
    });
    router.route("GET", "/enquiries/:id", async (context) => {
        const result = await (0, use_cases_1.getEnquiryUseCase)(resolveEnquiryId(context), toServiceContext(context), deps);
        return (0, api_1.jsonResponse)(result ? 200 : 404, result ?? { message: "enquiry not found" });
    });
    router.route("PUT", "/enquiries/:id", async (context) => {
        const result = await (0, use_cases_1.updateEnquiryUseCase)(resolveEnquiryId(context), context.body, toServiceContext(context), deps);
        return (0, api_1.jsonResponse)(result ? 200 : 404, result ?? { message: "enquiry not found" });
    });
    router.route("POST", "/enquiries/:id/close", async (context) => {
        const result = await (0, use_cases_1.closeEnquiryUseCase)(resolveEnquiryId(context), toServiceContext(context), deps);
        return (0, api_1.jsonResponse)(result ? 200 : 404, result ?? { message: "enquiry not found" });
    });
    return router;
}
