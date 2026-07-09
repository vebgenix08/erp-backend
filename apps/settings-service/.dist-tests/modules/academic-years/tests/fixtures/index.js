"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAcademicYearFixture = createAcademicYearFixture;
function createAcademicYearFixture(overrides = {}) {
    return {
        code: "2025-26",
        name: "Academic Year 2025-26",
        startDate: "2025-06-01",
        endDate: "2026-05-31",
        ...overrides,
    };
}
