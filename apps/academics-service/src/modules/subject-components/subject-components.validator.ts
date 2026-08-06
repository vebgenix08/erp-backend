import { ValidationError } from "@school-erp/errors";
import type { SubjectComponentInput, SubjectComponentType } from "./subject-components.model";
const types: SubjectComponentType[] = ["THEORY", "LECTURE", "PRACTICAL", "LAB", "TUTORIAL", "PROJECT", "SEMINAR", "ACTIVITY"];
const object = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const number = (value: unknown, field: string, minimum = 0) => { if (value === undefined || value === null || value === "") return undefined; const parsed = Number(value); if (!Number.isFinite(parsed) || parsed < minimum) throw new ValidationError([{ field, message: `${field} must be ${minimum} or greater` }]); return parsed; };
export function validateSubjectComponent(value: unknown): SubjectComponentInput {
  const input = object(value), curriculumSubjectId = text(input.curriculumSubjectId), componentType = text(input.componentType)?.toUpperCase() as SubjectComponentType | undefined;
  if (!curriculumSubjectId) throw new ValidationError([{ field: "curriculumSubjectId", message: "curriculumSubjectId is required" }]);
  if (!componentType || !types.includes(componentType)) throw new ValidationError([{ field: "componentType", message: "valid componentType is required" }]);
  const baselinePeriodsPerWeek = number(input.baselinePeriodsPerWeek, "baselinePeriodsPerWeek");
  const baselineContactHours = number(input.baselineContactHours, "baselineContactHours");
  const creditContribution = number(input.creditContribution, "creditContribution");
  const workloadMultiplier = number(input.workloadMultiplier, "workloadMultiplier", 0.1);
  const preferredSessionLength = number(input.preferredSessionLength, "preferredSessionLength", 1);
  const maximumPeriodsPerDay = number(input.maximumPeriodsPerDay, "maximumPeriodsPerDay", 1);
  const maximumGroupSize = number(input.maximumGroupSize, "maximumGroupSize", 1);
  const preferredRoomTypeId = text(input.preferredRoomTypeId);
  return { curriculumSubjectId, componentType, ...(baselinePeriodsPerWeek !== undefined ? { baselinePeriodsPerWeek } : {}), ...(baselineContactHours !== undefined ? { baselineContactHours } : {}), ...(creditContribution !== undefined ? { creditContribution } : {}), ...(workloadMultiplier !== undefined ? { workloadMultiplier } : {}), ...(preferredSessionLength !== undefined ? { preferredSessionLength } : {}), requiresConsecutivePeriods: input.requiresConsecutivePeriods === true, ...(maximumPeriodsPerDay !== undefined ? { maximumPeriodsPerDay } : {}), ...(preferredRoomTypeId ? { preferredRoomTypeId } : {}), ...(maximumGroupSize !== undefined ? { maximumGroupSize } : {}) };
}
