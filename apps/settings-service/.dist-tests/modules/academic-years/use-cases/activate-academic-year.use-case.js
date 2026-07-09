"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateAcademicYearUseCase = activateAcademicYearUseCase;
const academic_years_service_1 = require("../academic-years.service");
function activateAcademicYearUseCase(context, id, deps) {
    return (0, academic_years_service_1.activateAcademicYear)(context, id, deps);
}
