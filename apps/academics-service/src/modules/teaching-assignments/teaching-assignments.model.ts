export type TeachingAssignmentStatus = "ACTIVE" | "INACTIVE";
export type TeachingAssignmentRole = "SUBJECT_TEACHER" | "SECTION_INCHARGE";
export interface TeachingAssignmentRecord {
  id: string;
  tenantId: string;
  campusId: string;
  academicYearId: string;
  employeeId: string;
  employeeName: string;
  role: TeachingAssignmentRole;
  programId: string;
  classId: string;
  sectionId: string;
  subjectId?: string;
  status: TeachingAssignmentStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deactivatedAt?: Date;
}
export interface TeachingAssignmentInput {
  campusId: string;
  academicYearId: string;
  employeeId: string;
  employeeName: string;
  role: TeachingAssignmentRole;
  programId: string;
  classId: string;
  sectionId: string;
  subjectId?: string;
}
export interface TeachingAssignmentFilter {
  campusId: string;
  academicYearId?: string;
  employeeId?: string;
  classId?: string;
  sectionId?: string;
  subjectId?: string;
  role?: TeachingAssignmentRole;
  status?: TeachingAssignmentStatus;
}
