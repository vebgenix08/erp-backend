import type { AuthContext } from "@school-erp/auth";
import type { TenantContext } from "@school-erp/tenancy";

export type NotificationEvent =
  | "NEW_ENQUIRY" | "APPLICATION_SUBMITTED" | "APPLICATION_APPROVED" | "APPLICATION_REJECTED"
  | "FEE_PAID" | "STAFF_INVITED";
export type NotificationAudience = "TENANT_ADMINS" | "APPLICANT" | "PARENT_STUDENT" | "STAFF_MEMBER";

export interface NotificationEventPolicy {
  event: NotificationEvent;
  label: string;
  audience: NotificationAudience;
  email: boolean;
  sms: boolean;
}

export interface NotificationPolicyRecord {
  id: string;
  tenantId: string;
  adminEmail?: string | undefined;
  replyToEmail?: string | undefined;
  emailEnabled: boolean;
  smsEnabled: boolean;
  timezone: string;
  events: NotificationEventPolicy[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPolicyInput {
  adminEmail?: string | undefined;
  replyToEmail?: string | undefined;
  emailEnabled: boolean;
  smsEnabled: boolean;
  timezone: string;
  events: NotificationEventPolicy[];
}

export interface NotificationPolicyView extends Omit<NotificationPolicyRecord, "createdAt" | "updatedAt"> {
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPolicyServiceContext {
  tenantContext: TenantContext;
  authContext: AuthContext;
  requestId: string;
}

export const DEFAULT_NOTIFICATION_EVENTS: NotificationEventPolicy[] = [
  { event: "NEW_ENQUIRY", label: "New enquiry", audience: "TENANT_ADMINS", email: true, sms: false },
  { event: "APPLICATION_SUBMITTED", label: "Application submitted", audience: "TENANT_ADMINS", email: true, sms: false },
  { event: "APPLICATION_APPROVED", label: "Application approved", audience: "APPLICANT", email: true, sms: false },
  { event: "APPLICATION_REJECTED", label: "Application rejected", audience: "APPLICANT", email: true, sms: false },
  { event: "FEE_PAID", label: "Payment confirmation", audience: "PARENT_STUDENT", email: true, sms: false },
  { event: "STAFF_INVITED", label: "Staff invitation", audience: "STAFF_MEMBER", email: true, sms: false },
];
