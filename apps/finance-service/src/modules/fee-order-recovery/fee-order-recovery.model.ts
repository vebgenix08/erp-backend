import type { StudentEnrolledEventData } from "@school-erp/events";
export type FeeOrderRecoveryStatus = "PENDING" | "RESOLVED";
export interface FeeOrderRecoveryRecord {
  id: string;
  tenantId: string;
  eventId: string;
  studentId: string;
  studentName: string;
  registrationNumber: string;
  campusId: string;
  academicYearId: string;
  payload: StudentEnrolledEventData;
  status: FeeOrderRecoveryStatus;
  attempts: number;
  lastError: string;
  lastAttemptAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface FeeOrderRecoveryFilter {
  campusId?: string;
  academicYearId?: string;
  status?: FeeOrderRecoveryStatus;
  search?: string;
}
