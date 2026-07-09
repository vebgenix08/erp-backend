"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAcademicYearUseCase = getAcademicYearUseCase;
const academic_years_service_1 = require("../academic-years.service");
function getAcademicYearUseCase(context, id, deps) {
    return (0, academic_years_service_1.getAcademicYear)(context, id, deps);
}
