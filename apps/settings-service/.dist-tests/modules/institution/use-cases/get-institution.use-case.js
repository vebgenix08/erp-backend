"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInstitutionUseCase = getInstitutionUseCase;
const institution_service_1 = require("../institution.service");
function getInstitutionUseCase(context, deps) {
    return (0, institution_service_1.getInstitutionProfile)(context, deps);
}
