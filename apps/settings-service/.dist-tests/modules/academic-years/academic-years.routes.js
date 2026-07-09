"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAcademicYearRoutes = registerAcademicYearRoutes;
exports.mapAcademicYearRouteError = mapAcademicYearRouteError;
const api_1 = require("@school-erp/api");
const use_cases_1 = require("./use-cases");
const academic_years_validator_1 = require("./academic-years.validator");
function toSettingsContext(context) {
    return context;
}
function registerAcademicYearRoutes(router, deps = {}) {
    router.route("GET", "/academic-years", async (context) => {
        const result = await (0, use_cases_1.listAcademicYearsUseCase)(toSettingsContext(context), deps, (0, academic_years_validator_1.validateAcademicYearListFilter)(context.query));
        return (0, api_1.jsonResponse)(200, result);
    });
    router.route("POST", "/academic-years", async (context) => {
        const result = await (0, use_cases_1.createAcademicYearUseCase)(toSettingsContext(context), context.body, deps);
        return (0, api_1.jsonResponse)(201, result);
    });
    router.route("GET", "/academic-years/:id", async (context) => {
        const result = await (0, use_cases_1.getAcademicYearUseCase)(toSettingsContext(context), context.params.id ?? "", deps);
        return (0, api_1.jsonResponse)(result ? 200 : 404, result ?? { message: "academic year not found" });
    });
    router.route("PATCH", "/academic-years/:id", async (context) => {
        const result = await (0, use_cases_1.updateAcademicYearUseCase)(toSettingsContext(context), context.params.id ?? "", context.body, deps);
        return (0, api_1.jsonResponse)(result ? 200 : 404, result ?? { message: "academic year not found" });
    });
    router.route("POST", "/academic-years/:id/activate", async (context) => {
        const result = await (0, use_cases_1.activateAcademicYearUseCase)(toSettingsContext(context), context.params.id ?? "", deps);
        return (0, api_1.jsonResponse)(result ? 200 : 404, result ?? { message: "academic year not found" });
    });
    return router;
}
function mapAcademicYearRouteError(error) {
    return (0, api_1.errorResponse)(error);
}
