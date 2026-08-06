export type CampusTransferStatus = "DRAFT" | "UNDER_REVIEW" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
export interface CampusTransferLocation { campusId:string;academicYearId:string;programId:string;classId:string;sectionId?:string;enrollmentId:string;rollNumber?:string }
export interface CampusTransferHistory { status:CampusTransferStatus;at:Date;actorId:string;note?:string }
export interface CampusTransferRecord {
  id:string;tenantId:string;studentId:string;studentName:string;clientRequestId:string;
  admissionApplicationId:string;registrationNumber:string;
  targetRegistrationNumber:string;
  source:CampusTransferLocation;target:CampusTransferLocation;effectiveAt:Date;reason:string;note?:string;
  status:CampusTransferStatus;registrationAction:"KEEP"|"REGENERATE";executionArn?:string;
  financeAssessment?:Record<string,unknown>;warning?:string|undefined;failureReason?:string|undefined;
  requestedBy:string;reviewedBy?:string;completedAt?:Date;createdAt:Date;updatedAt:Date;history:CampusTransferHistory[];
}
export interface CreateCampusTransferInput { studentId:string;targetCampusId:string;academicYearId:string;targetClassId:string;targetSectionId?:string;effectiveAt:string;reason:string;note?:string;clientRequestId:string }
export interface CampusTransferPageFilter { search?:string;status?:CampusTransferStatus;page?:number;pageSize?:number }
export interface CampusTransferPage { items:CampusTransferRecord[];page:number;pageSize:number;total:number;totalPages:number }
