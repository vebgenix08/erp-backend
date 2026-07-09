"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivateCampusUseCase = deactivateCampusUseCase;
const campuses_service_1 = require("../campuses.service");
function deactivateCampusUseCase(context, id, deps) {
    return (0, campuses_service_1.deactivateCampus)(context, id, deps);
}
