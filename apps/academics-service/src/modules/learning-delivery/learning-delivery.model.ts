export type ActiveStatus = "ACTIVE" | "INACTIVE";
export interface AuditRecord {
  id: string; tenantId: string; createdAt: Date; createdBy: string; updatedAt: Date; updatedBy: string; version: number;
}
export interface SectionSubjectException extends AuditRecord {
  academicYearId: string; subjectPlanId: string; sectionId: string;
  action: "ADD" | "EXCLUDE" | "OVERRIDE_PERIODS" | "REPLACE_WITH_TEACHING_GROUP";
  componentOverrides?: Array<{ subjectComponentId: string; plannedPeriodsPerWeek?: number; preferredSessionLength?: number }>;
  reason: string; effectiveFrom: Date; effectiveUntil?: Date; status: ActiveStatus;
}
export interface SubjectChoiceGroup extends AuditRecord {
  campusId: string; academicYearId: string; academicUnitId: string; curriculumId: string; programId: string; academicLevelId: string;
  name: string; code: string; minimumSelections: number; maximumSelections: number; optionCurriculumSubjectIds: string[]; status: ActiveStatus;
}
export interface StudentSubjectChoice extends AuditRecord {
  academicYearId: string; studentId: string; enrollmentId: string; choiceGroupId: string; curriculumSubjectId: string;
  effectiveFrom: Date; effectiveUntil?: Date; status: "ACTIVE" | "CHANGED" | "CANCELLED"; selectedBy: string; approvedBy?: string; changeReason?: string;
}
export type TeachingGroupType = "SECTION" | "COMBINED_SECTIONS" | "LANGUAGE_GROUP" | "ELECTIVE_GROUP" | "PRACTICAL_BATCH" | "TUTORIAL_BATCH" | "PROJECT_GROUP";
export interface TeachingGroup extends AuditRecord {
  campusId: string; academicYearId: string; academicUnitId: string; curriculumId: string; programId: string; academicLevelId: string;
  type: TeachingGroupType; name: string; code: string; homeSectionId?: string; sourceSectionIds?: string[];
  capacity?: number; maximumGroupSize?: number; effectiveFrom: Date; effectiveUntil?: Date; status: ActiveStatus;
}
export interface TeachingGroupMembership extends AuditRecord {
  teachingGroupId: string; studentId: string; enrollmentId: string;
  membershipSource: "SECTION" | "SUBJECT_CHOICE" | "AUTO_BALANCE" | "MANUAL" | "IMPORT";
  effectiveFrom: Date; effectiveUntil?: Date; status: "ACTIVE" | "ENDED"; reason?: string;
}
export type SubjectBatchType = "LANGUAGE" | "ELECTIVE" | "PRACTICAL" | "TUTORIAL" | "COMBINED_SECTION" | "PROJECT";
export interface SubjectBatch extends AuditRecord {
  campusId: string; academicYearId: string; academicUnitId: string; curriculumId: string; programId: string; academicLevelId: string;
  curriculumSubjectId: string; subjectComponentId?: string; name: string; code: string; batchType: SubjectBatchType;
  sourceSectionIds: string[]; capacity?: number; maximumStrength?: number; effectiveFrom: Date; effectiveUntil?: Date; status: ActiveStatus;
}
export interface SubjectBatchMembership extends AuditRecord {
  subjectBatchId: string; studentId: string; enrollmentId: string;
  membershipSource: "SUBJECT_CHOICE" | "AUTO_BALANCE" | "MANUAL" | "IMPORT";
  effectiveFrom: Date; effectiveUntil?: Date; status: "ACTIVE" | "ENDED"; reason?: string;
}
export interface SubjectOffering extends AuditRecord {
  campusId: string; academicYearId: string; subjectPlanId: string; curriculumSubjectId: string; subjectComponentId: string;
  targetType: "SECTION" | "SUBJECT_BATCH"; sectionId?: string; subjectBatchId?: string; teachingGroupId?: string;
  requiredPeriodsPerWeek: number; requiredConsecutiveSlots: number; preferredSessionLength: number; requiresConsecutivePeriods: boolean; maximumPeriodsPerDay?: number;
  preferredRoomTypeId?: string; preferredRoomIds?: string[]; parallelBlockId?: string; effectiveFrom: Date; effectiveUntil?: Date;
  readinessStatus: "INCOMPLETE" | "READY" | "BLOCKED"; status: ActiveStatus;
}
export interface ParallelTimetableBlock extends AuditRecord {
  campusId: string; academicYearId: string; academicUnitId: string; programId: string; academicLevelId: string;
  name: string; code: string; type: "SUBJECT_CHOICE" | "LANGUAGE" | "ELECTIVE" | "ROTATION";
  sourceSectionIds: string[]; requiredOfferingIds: string[]; mustRunSimultaneously: boolean; status: ActiveStatus;
}
