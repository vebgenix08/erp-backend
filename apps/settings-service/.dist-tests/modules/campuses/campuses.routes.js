"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCampusRoutes = registerCampusRoutes;
exports.mapCampusRouteError = mapCampusRouteError;
const api_1 = require("@school-erp/api");
const use_cases_1 = require("./use-cases");
const campuses_validator_1 = require("./campuses.validator");
function toSettingsContext(context) {
    return context;
}
function registerCampusRoutes(router, deps = {}) {
    router.route("GET", "/campuses", async (context) => {
        const result = await (0, use_cases_1.listCampusesUseCase)(toSettingsContext(context), deps, (0, campuses_validator_1.validateCampusListFilter)(context.query));
        return (0, api_1.jsonResponse)(200, result);
    });
    router.route("POST", "/campuses", async (context) => {
        const result = await (0, use_cases_1.createCampusUseCase)(toSettingsContext(context), context.body, deps);
        return (0, api_1.jsonResponse)(201, result);
    });
    router.route("GET", "/campuses/:id", async (context) => {
        const result = await (0, use_cases_1.getCampusUseCase)(toSettingsContext(context), context.params.id ?? "", deps);
        return (0, api_1.jsonResponse)(result ? 200 : 404, result ?? { message: "campus not found" });
    });
    router.route("PATCH", "/campuses/:id", async (context) => {
        const result = await (0, use_cases_1.updateCampusUseCase)(toSettingsContext(context), context.params.id ?? "", context.body, deps);
        return (0, api_1.jsonResponse)(result ? 200 : 404, result ?? { message: "campus not found" });
    });
    router.route("POST", "/campuses/:id/deactivate", async (context) => {
        const result = await (0, use_cases_1.deactivateCampusUseCase)(toSettingsContext(context), context.params.id ?? "", deps);
        return (0, api_1.jsonResponse)(result ? 200 : 404, result ?? { message: "campus not found" });
    });
    return router;
}
function mapCampusRouteError(error) {
    return (0, api_1.errorResponse)(error);
}
