"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCampusUseCase = createCampusUseCase;
const campuses_service_1 = require("../campuses.service");
function createCampusUseCase(context, input, deps) {
    return (0, campuses_service_1.createCampus)(context, input, deps);
}
