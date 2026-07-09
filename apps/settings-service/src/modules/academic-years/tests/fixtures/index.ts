import type { AcademicYearCreateInput } from "../../academic-years.model";

export function createAcademicYearFixture(overrides: Partial<AcademicYearCreateInput> = {}): AcademicYearCreateInput {
  return {
    code: "2025-26",
    name: "Academic Year 2025-26",
    startDate: "2025-06-01",
    endDate: "2026-05-31",
    ...overrides,
  };
}
