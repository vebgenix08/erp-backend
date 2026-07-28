export const TENANT_CAPABILITY_CODES = [
  "STAFF_MANAGEMENT",
  "ACADEMICS",
  "STUDENT_MANAGEMENT",
  "ADMISSIONS",
  "FINANCE",
  "ATTENDANCE",
  "TIMETABLE",
  "EXAMS_RESULTS",
  "COMMUNICATIONS",
  "LEAVE",
  "REPORTING",
  "PARENT_STUDENT_PORTAL",
] as const;

export type TenantCapabilityCode = (typeof TENANT_CAPABILITY_CODES)[number];

export interface TenantCapabilityDefinition {
  code: TenantCapabilityCode;
  name: string;
  description: string;
  owner: string;
  designSections: readonly number[];
  dependencies: readonly TenantCapabilityCode[];
}
