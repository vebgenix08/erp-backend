"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCampusUseCase = updateCampusUseCase;
const campuses_service_1 = require("../campuses.service");
function updateCampusUseCase(context, id, input, deps) {
    return (0, campuses_service_1.updateCampus)(context, id, input, deps);
}
