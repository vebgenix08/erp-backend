"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAcademicYearsUseCase = listAcademicYearsUseCase;
const academic_years_service_1 = require("../academic-years.service");
function listAcademicYearsUseCase(context, deps, filter) {
    return (0, academic_years_service_1.listAcademicYears)(context, deps, filter);
}
