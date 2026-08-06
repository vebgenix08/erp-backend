import { ValidationError } from "@school-erp/errors";
import type { AcademicYearSubjectPlanInput, SubjectPlanComponent } from "./academic-year-subject-plans.model";
const object = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const required = (input: Record<string, unknown>, field: string) => { const value = text(input[field]); if (!value) throw new ValidationError([{ field, message: `${field} is required` }]); return value; };
const positive = (value: unknown, field: string) => { const parsed = Number(value); if (!Number.isFinite(parsed) || parsed < 1) throw new ValidationError([{ field, message: `${field} must be positive` }]); return parsed; };
export function validateAcademicYearSubjectPlan(value: unknown): AcademicYearSubjectPlanInput {
  const input = object(value);
  if (!Array.isArray(input.componentPlans) || !input.componentPlans.length) throw new ValidationError([{ field: "componentPlans", message: "at least one component plan is required" }]);
  const componentPlans: SubjectPlanComponent[] = input.componentPlans.map((item, index) => {
    const component = object(item), subjectComponentId = text(component.subjectComponentId), plannedPeriodsPerWeek = positive(component.plannedPeriodsPerWeek, `componentPlans.${index}.plannedPeriodsPerWeek`), preferredSessionLength = positive(component.preferredSessionLength ?? 1, `componentPlans.${index}.preferredSessionLength`);
    if (!subjectComponentId) throw new ValidationError([{ field: `componentPlans.${index}.subjectComponentId`, message: "subjectComponentId is required" }]);
    const overrideReason = text(component.overrideReason), isOverride = component.isOverride === true;
    if (isOverride && !overrideReason) throw new ValidationError([{ field: `componentPlans.${index}.overrideReason`, message: "overrideReason is required for an override" }]);
    return { subjectComponentId, plannedPeriodsPerWeek, preferredSessionLength, isOverride, ...(overrideReason ? { overrideReason } : {}) };
  });
  return { campusId: required(input, "campusId"), academicYearId: required(input, "academicYearId"), academicUnitId: required(input, "academicUnitId"), curriculumId: required(input, "curriculumId"), programId: required(input, "programId"), academicLevelId: required(input, "academicLevelId"), curriculumSubjectId: required(input, "curriculumSubjectId"), appliesToAllSections: input.appliesToAllSections !== false, componentPlans };
}
