import type { RequestContext } from "@school-erp/api";
import { requirePlatformPermission } from "../../middleware";
import { platformPermissions } from "../../permissions";
import type { TenantCapabilityCode, TenantCapabilityDefinition } from "./capability-catalog.model";

export const TENANT_CAPABILITY_CATALOG: readonly TenantCapabilityDefinition[] = [
  { code: "STAFF_MANAGEMENT", name: "Staff management", description: "Staff onboarding, employee records, login enablement and invite lifecycle.", owner: "identity-service", designSections: [8, 9], dependencies: [] },
  { code: "ACADEMICS", name: "Academics", description: "Programs, classes, sections, subjects, assignments and academic lifecycle.", owner: "academics-service", designSections: [10, 11, 37], dependencies: [] },
  { code: "STUDENT_MANAGEMENT", name: "Student management", description: "Enrollment, registration, section placement, transfers and student profiles.", owner: "academics-service", designSections: [17, 18, 26], dependencies: ["ACADEMICS"] },
  { code: "ADMISSIONS", name: "Admissions", description: "Enquiries, applications, reviews, confirmation and conversion to student.", owner: "admissions-service", designSections: [13, 14, 15, 16], dependencies: ["ACADEMICS", "STUDENT_MANAGEMENT"] },
  { code: "FINANCE", name: "Finance", description: "Fee setup, charges, orders, payments, ledger, receipts and reconciliation.", owner: "finance-service", designSections: [19, 20, 21, 22, 23, 24, 25, 27, 38], dependencies: ["ACADEMICS", "STUDENT_MANAGEMENT"] },
  { code: "ATTENDANCE", name: "Attendance", description: "Student attendance operations and reports.", owner: "academics-service", designSections: [29], dependencies: ["ACADEMICS", "STUDENT_MANAGEMENT"] },
  { code: "TIMETABLE", name: "Timetable", description: "Timetable planning, publication and substitutions.", owner: "academics-service", designSections: [30], dependencies: ["ACADEMICS", "STAFF_MANAGEMENT"] },
  { code: "EXAMS_RESULTS", name: "Exams and results", description: "Exam setup, marks, calculations, publication and report cards.", owner: "results-service", designSections: [31, 32, 33], dependencies: ["ACADEMICS", "STUDENT_MANAGEMENT"] },
  { code: "COMMUNICATIONS", name: "Communications", description: "Announcements, notifications and delivery tracking.", owner: "comms-service", designSections: [34], dependencies: [] },
  { code: "LEAVE", name: "Leave", description: "Employee and student leave request and approval workflows.", owner: "identity-service", designSections: [35], dependencies: ["STAFF_MANAGEMENT"] },
  { code: "REPORTING", name: "Central reporting", description: "Cross-domain reports, saved views, schedules and export jobs.", owner: "reporting-module", designSections: [36], dependencies: [] },
  { code: "PARENT_STUDENT_PORTAL", name: "Parent and student portal", description: "Verified account linking and scoped self-service domain views.", owner: "identity-service", designSections: [39], dependencies: ["STUDENT_MANAGEMENT"] },
] as const;

const definitions = new Map<TenantCapabilityCode, TenantCapabilityDefinition>(
  TENANT_CAPABILITY_CATALOG.map((definition) => [definition.code, definition]),
);

export function isTenantCapabilityCode(value: string): value is TenantCapabilityCode {
  return definitions.has(value as TenantCapabilityCode);
}

export function getTenantCapabilityDefinition(code: TenantCapabilityCode): TenantCapabilityDefinition {
  return definitions.get(code) as TenantCapabilityDefinition;
}

export function listTenantCapabilities(context: RequestContext): readonly TenantCapabilityDefinition[] {
  requirePlatformPermission(context, platformPermissions.entitlements.read);
  return TENANT_CAPABILITY_CATALOG;
}
