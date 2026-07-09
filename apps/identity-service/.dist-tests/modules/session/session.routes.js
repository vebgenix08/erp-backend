"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSessionRoutes = registerSessionRoutes;
const api_1 = require("@school-erp/api");
const use_cases_1 = require("./use-cases");
const session_validator_1 = require("./session.validator");
function registerSessionRoutes(router, deps = {}) {
    router.route("GET", "/session/me", async (context) => {
        const result = await (0, use_cases_1.getSessionUseCase)(context, deps);
        return (0, api_1.jsonResponse)(200, result);
    });
    router.route("POST", "/session/select-tenant", async (context) => {
        const result = await (0, use_cases_1.selectTenantUseCase)((0, session_validator_1.validateSelectTenantInput)(context.body), context, deps);
        return (0, api_1.jsonResponse)(200, result);
    });
    router.route("POST", "/session/logout", async (context) => {
        const result = await (0, use_cases_1.logoutUseCase)(context);
        return (0, api_1.jsonResponse)(200, result);
    });
    return router;
}
