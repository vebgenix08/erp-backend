import type { SubjectComponentType } from "../subject-components/subject-components.model";
export interface FacultyAudit { id: string; tenantId: string; createdAt: Date; createdBy: string; updatedAt: Date; updatedBy: string; version: number }
export interface EmployeeCampusAssignment extends FacultyAudit {
  employeeId: string; campusId: string; assignmentType: "PRIMARY" | "TEACHING" | "SHARED_FACULTY" | "VISITING" | "TEMPORARY";
  availableForTeaching: boolean; effectiveFrom: Date; effectiveUntil?: Date; approvedBy: string; status: "ACTIVE" | "INACTIVE";
}
export interface TeacherSubjectEligibility extends FacultyAudit {
  employeeId: string; subjectCatalogueId: string; curriculumId?: string; programId?: string; academicLevelIds?: string[];
  componentTypes?: SubjectComponentType[]; qualificationReference?: string; proficiencyLevel?: string;
  effectiveFrom: Date; effectiveUntil?: Date; status: "ACTIVE" | "INACTIVE";
}
export type AssignmentRole = "PRIMARY" | "CO_TEACHER" | "ASSISTANT" | "PRACTICAL_INSTRUCTOR" | "TUTOR" | "PROJECT_GUIDE" | "TEMPORARY_COVER";
export interface OfferingTeacherAssignment extends FacultyAudit {
  subjectOfferingId: string; employeeId: string; assignmentRole: AssignmentRole; workloadSharePercentage?: number;
  effectiveFrom: Date; effectiveUntil?: Date; eligibilityStatus: "VERIFIED" | "OVERRIDDEN" | "NOT_REQUIRED";
  eligibilityOverrideReason?: string; eligibilityOverriddenBy?: string; status: "ACTIVE" | "ENDED" | "CANCELLED";
}
export interface AcademicResponsibility extends FacultyAudit {
  employeeId: string; academicYearId: string; campusId: string;
  responsibilityType: "CLASS_TEACHER" | "SECTION_INCHARGE" | "MENTOR" | "HOD" | "PROGRAM_COORDINATOR" | "TIMETABLE_COORDINATOR";
  academicUnitId?: string; programId?: string; academicLevelId?: string; sectionId?: string;
  effectiveFrom: Date; effectiveUntil?: Date; status: "ACTIVE" | "ENDED";
}
export interface TeacherAvailability extends FacultyAudit {
  employeeId: string; campusId?: string; academicYearId: string; dayOfWeek: string; startTime: string; endTime: string;
  availabilityType: "BLOCKED" | "PREFERRED"; effectiveFrom: Date; effectiveUntil?: Date; reason?: string; status: "ACTIVE" | "INACTIVE";
}
export interface TeacherWorkloadPolicy extends FacultyAudit {
  scopeType?: "DEFAULT" | "STAFF_TYPE" | "DESIGNATION" | "EMPLOYEE"; employeeId?: string; academicUnitId?: string; staffType?: string; designationId?: string;
  maximumContactPeriodsPerWeek?: number; maximumWeightedUnitsPerWeek?: number; maximumPeriodsPerDay?: number; maximumConsecutivePeriods?: number;
  effectiveFrom?: Date; effectiveUntil?: Date; reason?: string; componentMultipliers: Partial<Record<SubjectComponentType, number>>;
  status: "ACTIVE" | "INACTIVE";
}
export interface WorkloadItem { employeeId: string; campusId: string; contactPeriods: number; weightedUnits: number }
export interface WorkloadSummary { employeeId: string; contactPeriods: number; weightedUnits: number; campusBreakdown: Array<{ campusId: string; contactPeriods: number; weightedUnits: number }>; exceedsContactLimit: boolean; exceedsWeightedLimit: boolean }
