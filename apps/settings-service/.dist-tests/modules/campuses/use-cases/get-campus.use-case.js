"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCampusUseCase = getCampusUseCase;
const campuses_service_1 = require("../campuses.service");
function getCampusUseCase(context, id, deps) {
    return (0, campuses_service_1.getCampus)(context, id, deps);
}
