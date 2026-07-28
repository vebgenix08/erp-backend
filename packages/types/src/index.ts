export type TenantType = "INSTITUTION" | "SCHOOL" | "COLLEGE" | "DEGREE_COLLEGE";
export type TenantStatus = "ONBOARDING" | "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DELETION_PENDING";

export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "INVITED";
export type AdmissionStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "ACCEPTED"
  | "REJECTED";
export type StudentStatus = "ACTIVE" | "INACTIVE" | "GRADUATED" | "TRANSFERRED" | "DROPPED_OUT";
export type FeeOrderStatus =
  | "DRAFT"
  | "PENDING"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CANCELLED"
  | "REFUNDED";
export type PaymentStatus = "PENDING" | "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUNDED";
export type ReceiptStatus = "ISSUED" | "VOID" | "CANCELLED";
export type PermissionAction = "CREATE" | "READ" | "UPDATE" | "DELETE" | "LIST" | "MANAGE";
