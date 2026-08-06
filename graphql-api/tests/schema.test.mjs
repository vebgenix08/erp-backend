import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../schema/root.graphql", import.meta.url);
const platform = new URL("../schema/modules/platform.graphql", import.meta.url);
const settings = new URL("../schema/modules/settings.graphql", import.meta.url);
const academics = new URL("../schema/modules/academics.graphql", import.meta.url);
const admissions = new URL(
  "../schema/modules/admissions.graphql",
  import.meta.url,
);

test("schema keeps authenticated platform operations in GraphQL", async () => {
  const schema = `${await readFile(root, "utf8")}\n${await readFile(platform, "utf8")}`;
  for (const operation of [
    "tenants(first",
    "tenant(tenantId",
    "provisionTenant",
    "updateTenant",
    "deactivateTenant",
    "tenantEntitlements",
    "platformIntegrations",
    "inviteDeliveryEvents",
  ]) {
    assert.ok(schema.includes(operation));
  }
  assert.doesNotMatch(schema, /upload|download|webhook|pdf/i);
});

test("critical tenant mutations require idempotency", async () => {
  const schema = await readFile(platform, "utf8");
  assert.match(schema, /clientRequestId: ID!/);
  assert.match(
    schema,
    /deactivateTenant\(tenantId: ID!, clientRequestId: ID!\)/,
  );
  assert.match(
    schema,
    /tenants\(first: Int = 25, after: String\): TenantConnection!/,
  );
});

test("every tenant subscription source exists as a mutation", async () => {
  const schema = `${await readFile(root, "utf8")}\n${await readFile(platform, "utf8")}`;
  const sourceList =
    schema.match(/@aws_subscribe\(mutations: \[([^\]]+)\]\)/)?.[1] ?? "";
  const sources = [...sourceList.matchAll(/"([A-Za-z0-9_]+)"/g)].map(
    (match) => match[1],
  );
  assert.ok(sources.length > 0);
  for (const source of sources)
    assert.ok(schema.includes(`${source}(`), `missing mutation ${source}`);
  assert.doesNotMatch(schema, /_contract/);
});

test("AppSync root operation types do not use extensions", async () => {
  const schema = `${await readFile(root, "utf8")}\n${await readFile(platform, "utf8")}\n${await readFile(settings, "utf8")}`;
  assert.doesNotMatch(schema, /extend type (Query|Mutation|Subscription)/);
});

test("tenant settings operations are exposed through the canonical root contract", async () => {
  const schema = `${await readFile(platform, "utf8")}\n${await readFile(settings, "utf8")}`;
  for (const operation of [
    "institutionProfile",
    "campuses",
    "academicYears",
    "tenantTemplates",
    "tenantCapabilityCatalog",
    "updateInstitutionProfile",
    "createCampus",
    "activateAcademicYear",
    "publishTenantTemplate",
  ]) {
    assert.match(
      schema,
      new RegExp(`\\b${operation}\\s*(?:\\(|:)`),
      `missing settings operation ${operation}`,
    );
  }
});

test("academic-year lifecycle fields belong only to AcademicYear", async () => {
  const schema = await readFile(settings, "utf8");
  const campus = schema.match(/type Campus \{([\s\S]*?)\n\}/)?.[1] ?? "";
  const academicYear =
    schema.match(/type AcademicYear \{([\s\S]*?)\n\}/)?.[1] ?? "";

  assert.doesNotMatch(campus, /closedAt|reopenedAt|lifecycleReason/);
  for (const field of ["closedAt", "reopenedAt", "lifecycleReason"]) {
    assert.match(academicYear, new RegExp(`\\b${field}:`));
  }
});

test("admissions enquiry root operations include their domain types", async () => {
  const schema = `${await readFile(platform, "utf8")}\n${await readFile(admissions, "utf8")}`;
  assert.match(schema, /type Enquiry\s*\{/);
  assert.match(schema, /input EnquiryFilter\s*\{/);
  assert.match(schema, /enquiries\(filter: EnquiryFilter\): \[Enquiry!\]!/);
  assert.match(schema, /createEnquiry\(input: CreateEnquiryInput!\): Enquiry!/);
});

test("admission application exposes the canonical lifecycle through AppSync", async () => {
  const schema = `${await readFile(platform, "utf8")}\n${await readFile(admissions, "utf8")}`;
  assert.match(
    schema,
    /enum ApplicationStatus\s*\{\s*DRAFT\s+SUBMITTED\s+APPROVED\s+REJECTED\s+CONFIRMED\s+CANCELLED\s*\}/,
  );
  assert.match(
    schema,
    /applications\s*\(\s*filter:\s*ApplicationFilter\s*\):\s*\[AdmissionApplication!\]!/,
  );
  assert.match(
    schema,
    /submitApplication\s*\(\s*id:\s*ID!\s*\):\s*AdmissionApplication!/,
  );
  assert.match(
    schema,
    /approveApplication\s*\(\s*id:\s*ID!\s*,?\s*input:\s*ApplicationReviewInput\s*\):\s*AdmissionApplication!/,
  );
  assert.match(
    schema,
    /rejectApplication\s*\(\s*id:\s*ID!\s*,?\s*input:\s*ApplicationRejectInput!\s*\):\s*AdmissionApplication!/,
  );
  assert.match(
    schema,
    /applicationDuplicateCheck\s*\(\s*id:\s*ID!\s*\):\s*ApplicationDuplicateCheck!/,
  );
  assert.match(
    schema,
    /confirmApplication\s*\(\s*id:\s*ID!\s*,?\s*input:\s*AdmissionConfirmationInput!\s*\):\s*AdmissionApplication!/,
  );
});

test("tenant admin dashboard exposes one complete aggregate contract", async () => {
  const schema = `${await readFile(platform, "utf8")}\n${await readFile(settings, "utf8")}`;
  assert.match(
    schema,
    /tenantAdminDashboard\(input: TenantAdminDashboardInput!\): TenantAdminDashboard!/,
  );
  const dashboard =
    schema.match(/type TenantAdminDashboard \{([\s\S]*?)\n\}/)?.[1] ?? "";
  for (const field of [
    "applicationStatusDistribution",
    "studentClassDistribution",
    "collectionTrend",
    "collectionByPaymentMethod",
    "topOutstandingClasses",
    "recentSecurityChanges",
    "recentApplications",
    "recentActivity",
  ]) {
    assert.match(dashboard, new RegExp(`\\b${field}:`), `missing dashboard field ${field}`);
  }
});

test("timetable editing mutations remain in the canonical contract", async () => {
  const schema = await readFile(platform, "utf8");
  for (const operation of ["addTimetableEntry", "updateTimetableEntry", "deactivateTimetableEntry", "createTimetableRevision"]) {
    assert.match(schema, new RegExp(`\\b${operation}\\b`), `${operation} is missing from the canonical schema`);
  }
});

test("Class Setup exposes one canonical aggregate and page-owned mutations", async () => {
  const schema = `${await readFile(platform, "utf8")}\n${await readFile(academics, "utf8")}`;
  assert.match(schema, /classSetupWorkspace\(input: ClassSetupContextInput!\): ClassSetupWorkspace!/);
  assert.match(schema, /generateClassTimetable\(input: ClassSetupContextInput!\): ClassTimetableGenerationResult!/);
  assert.match(schema, /updateClassSetupSubject\(input: UpdateClassSetupSubjectInput!\): ClassSetupWorkspace!/);
  assert.match(schema, /removeClassSetupSubject\(input: RemoveClassSetupSubjectInput!\): ClassSetupWorkspace!/);
  assert.match(schema, /saveClassSetupTiming\(input: SaveClassSetupTimingInput!\): ClassSetupWorkspace!/);
  assert.doesNotMatch(schema, /academicScheduleWorkspace|prepareAndGenerateAcademicSchedule|AcademicScheduleContextInput/);
});
