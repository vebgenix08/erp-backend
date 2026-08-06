export type SubjectComponentType = "THEORY" | "LECTURE" | "PRACTICAL" | "LAB" | "TUTORIAL" | "PROJECT" | "SEMINAR" | "ACTIVITY";
export type SubjectComponentStatus = "ACTIVE" | "INACTIVE";
export interface SubjectComponentRecord {
  id: string; tenantId: string; curriculumSubjectId: string; componentType: SubjectComponentType;
  baselinePeriodsPerWeek?: number; baselineContactHours?: number; creditContribution?: number;
  workloadMultiplier: number; preferredSessionLength: number; requiresConsecutivePeriods: boolean;
  maximumPeriodsPerDay?: number; preferredRoomTypeId?: string; maximumGroupSize?: number;
  status: SubjectComponentStatus; createdAt: Date; createdBy: string; updatedAt: Date; updatedBy: string; version: number;
  deactivatedAt?: Date; deactivatedBy?: string; deactivationReason?: string;
}
export type SubjectComponentInput = Pick<SubjectComponentRecord, "curriculumSubjectId" | "componentType"> &
  Partial<Pick<SubjectComponentRecord, "baselinePeriodsPerWeek" | "baselineContactHours" | "creditContribution" |
  "workloadMultiplier" | "preferredSessionLength" | "requiresConsecutivePeriods" | "maximumPeriodsPerDay" |
  "preferredRoomTypeId" | "maximumGroupSize">>;
export type SubjectComponentFilter = Partial<Pick<SubjectComponentRecord, "curriculumSubjectId" | "componentType" | "status">>;
