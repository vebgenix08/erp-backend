export type StudentDocumentType =
  | "BONAFIDE_CERTIFICATE"
  | "STUDY_CERTIFICATE"
  | "TRANSFER_CERTIFICATE"
  | "STUDENT_ID_CARD";
export type StudentDocumentStatus = "ISSUED" | "REVOKED";
export interface StudentDocumentRecord {
  id: string;
  tenantId: string;
  documentNumber: string;
  documentType: StudentDocumentType;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  registrationNumber: string;
  campusId: string;
  academicYearId: string;
  classId: string;
  sectionId?: string;
  purpose?: string;
  validUntil?: Date;
  status: StudentDocumentStatus;
  issuedBy: string;
  issuedAt: Date;
  updatedAt: Date;
  revokedAt?: Date;
  revokedBy?: string;
  revokeReason?: string;
}
export interface IssueStudentDocumentInput {
  studentId: string;
  documentType: StudentDocumentType;
  purpose?: string;
  validUntil?: string;
}
export interface StudentDocumentFilter {
  studentId?: string;
  campusId?: string;
  academicYearId?: string;
  documentType?: StudentDocumentType;
  status?: StudentDocumentStatus;
}

export interface StudentDocumentPageFilter extends StudentDocumentFilter {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface StudentDocumentPage {
  items: StudentDocumentRecord[];
  summary: {
    total: number;
    certificates: number;
    idCards: number;
    revoked: number;
  };
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
