"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAcademicYearUseCase = updateAcademicYearUseCase;
const academic_years_service_1 = require("../academic-years.service");
function updateAcademicYearUseCase(context, id, input, deps) {
    return (0, academic_years_service_1.updateAcademicYear)(context, id, input, deps);
}
