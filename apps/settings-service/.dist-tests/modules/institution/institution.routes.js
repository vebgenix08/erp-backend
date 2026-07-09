"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerInstitutionRoutes = registerInstitutionRoutes;
exports.mapInstitutionRouteError = mapInstitutionRouteError;
const api_1 = require("@school-erp/api");
const use_cases_1 = require("./use-cases");
function toSettingsContext(context) {
    return context;
}
function registerInstitutionRoutes(router, deps = {}) {
    router.route("GET", "/institution", async (context) => {
        const result = await (0, use_cases_1.getInstitutionUseCase)(toSettingsContext(context), deps);
        return (0, api_1.jsonResponse)(result ? 200 : 404, result ?? { message: "institution profile not found" });
    });
    router.route("PATCH", "/institution", async (context) => {
        const result = await (0, use_cases_1.updateInstitutionUseCase)(context.body, toSettingsContext(context), deps);
        return (0, api_1.jsonResponse)(200, result);
    });
    return router;
}
function mapInstitutionRouteError(error) {
    return (0, api_1.errorResponse)(error);
}
