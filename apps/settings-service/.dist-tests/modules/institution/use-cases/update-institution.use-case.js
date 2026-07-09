"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateInstitutionUseCase = updateInstitutionUseCase;
const institution_service_1 = require("../institution.service");
function updateInstitutionUseCase(input, context, deps) {
    return (0, institution_service_1.updateInstitutionProfile)(input, context, deps);
}
