"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTenantRoutes = registerTenantRoutes;
const api_1 = require("@school-erp/api");
const use_cases_1 = require("./use-cases");
function tenantId(context) {
    return context.params.id ?? "";
}
function registerTenantRoutes(router, deps = {}) {
    router.route("GET", "/tenants", async (_context) => {
        const result = await (0, use_cases_1.listTenantsUseCase)(deps);
        return (0, api_1.jsonResponse)(200, result);
    });
    router.route("GET", "/tenants/:id", async (context) => {
        const result = await (0, use_cases_1.getTenantUseCase)(tenantId(context), deps);
        return (0, api_1.jsonResponse)(result ? 200 : 404, result ?? { message: "tenant not found" });
    });
    router.route("POST", "/tenants", async (context) => {
        const result = await (0, use_cases_1.createTenantUseCase)(context.body, deps);
        return (0, api_1.jsonResponse)(201, result);
    });
    router.route("PUT", "/tenants/:id", async (context) => {
        const result = await (0, use_cases_1.updateTenantUseCase)(tenantId(context), context.body, deps);
        return (0, api_1.jsonResponse)(result ? 200 : 404, result ?? { message: "tenant not found" });
    });
    router.route("POST", "/tenants/:id/deactivate", async (context) => {
        const result = await (0, use_cases_1.deactivateTenantUseCase)(tenantId(context), deps);
        return (0, api_1.jsonResponse)(result ? 200 : 404, result ?? { message: "tenant not found" });
    });
    return router;
}
