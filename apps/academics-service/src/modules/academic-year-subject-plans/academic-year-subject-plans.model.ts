export type SubjectPlanStatus = "DRAFT" | "ACTIVE" | "CLOSED";
export interface SubjectPlanComponent {
  subjectComponentId: string; plannedPeriodsPerWeek: number; plannedContactHours?: number;
  preferredSessionLength: number; maximumPeriodsPerDay?: number; preferredRoomTypeId?: string;
  isOverride: boolean; overrideReason?: string;
}
export interface AcademicYearSubjectPlanRecord {
  id: string; tenantId: string; campusId: string; academicYearId: string; academicUnitId: string;
  curriculumId: string; programId: string; academicLevelId: string; curriculumSubjectId: string;
  appliesToAllSections: boolean; componentPlans: SubjectPlanComponent[]; status: SubjectPlanStatus;
  createdAt: Date; createdBy: string; updatedAt: Date; updatedBy: string; version: number;
  activatedAt?: Date; activatedBy?: string; closedAt?: Date; closedBy?: string;
}
export type AcademicYearSubjectPlanInput = Pick<AcademicYearSubjectPlanRecord,
  "campusId" | "academicYearId" | "academicUnitId" | "curriculumId" | "programId" | "academicLevelId" |
  "curriculumSubjectId" | "appliesToAllSections" | "componentPlans">;
export type AcademicYearSubjectPlanFilter = Partial<Pick<AcademicYearSubjectPlanRecord,
  "campusId" | "academicYearId" | "academicUnitId" | "curriculumId" | "programId" | "academicLevelId" | "curriculumSubjectId" | "status">>;
