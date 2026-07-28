export type StudentStatus = "ACTIVE" | "INACTIVE" | "GRADUATED" | "TRANSFERRED";
export type EnrollmentStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";
export type StudentGender = "MALE" | "FEMALE" | "OTHER";
export interface GuardianSnapshot {
  name: string;
  phone?: string;
  relation?: string;
}
export interface StudentRecord {
  id: string;
  tenantId: string;
  admissionApplicationId: string;
  admissionNumber: string;
  registrationNumber: string;
  name: string;
  dateOfBirth?: Date;
  gender?: StudentGender;
  phone: string;
  email?: string;
  address?: string;
  guardian: GuardianSnapshot;
  status: StudentStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface EnrollmentRecord {
  id: string;
  tenantId: string;
  studentId: string;
  campusId: string;
  academicYearId: string;
  programId: string;
  classId: string;
  sectionId?: string;
  rollNumber?: string;
  status: EnrollmentStatus;
  enrolledAt: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface CreateStudentFromAdmissionInput {
  admissionApplicationId: string;
  admissionNumber: string;
  campusId: string;
  academicYearId: string;
  classId: string;
  sectionId?: string;
  studentName: string;
  dateOfBirth?: string;
  gender?: StudentGender;
  phone: string;
  email?: string;
  address?: string;
  parentName: string;
  parentPhone?: string;
  parentRelation?: string;
  confirmedBy: string;
  confirmedAt: string;
}
export interface StudentWithEnrollment {
  student: StudentRecord;
  enrollment: EnrollmentRecord;
}
export interface ChangeStudentEnrollmentInput {
  campusId: string;
  academicYearId: string;
  classId: string;
  sectionId?: string;
  rollNumber?: string;
  reason: string;
}
export interface StudentListFilter {
  campusId?: string;
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  status?: StudentStatus;
  search?: string;
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
  sortBy?: StudentSortField;
  sortDirection?: SortDirection;
}
export type StudentSortField =
  | "name"
  | "admissionNumber"
  | "registrationNumber"
  | "createdAt";
export type SortDirection = "ASC" | "DESC";
export interface StudentPage {
  items: StudentWithEnrollment[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sortBy: StudentSortField;
  sortDirection: SortDirection;
}
