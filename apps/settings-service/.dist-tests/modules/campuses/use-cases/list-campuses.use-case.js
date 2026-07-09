"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCampusesUseCase = listCampusesUseCase;
const campuses_service_1 = require("../campuses.service");
function listCampusesUseCase(context, deps, filter) {
    return (0, campuses_service_1.listCampuses)(context, deps, filter);
}
