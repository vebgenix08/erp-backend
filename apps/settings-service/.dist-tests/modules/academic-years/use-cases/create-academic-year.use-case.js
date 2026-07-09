"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAcademicYearUseCase = createAcademicYearUseCase;
const academic_years_service_1 = require("../academic-years.service");
function createAcademicYearUseCase(context, input, deps) {
    return (0, academic_years_service_1.createAcademicYear)(context, input, deps);
}
