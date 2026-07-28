import test from "node:test";
import assert from "node:assert/strict";
import type { RequestContext } from "@school-erp/api";
import { createTeachingAssignment, deactivateTeachingAssignment, listTeachingAssignments } from "../teaching-assignments.service";
import { InMemoryTeachingAssignmentRepository } from "../teaching-assignments.repository";

function context(tenantId = "tenant_one"): RequestContext {
  return { requestId: "request", method: "POST", path: "/teaching-assignments", headers: {}, query: {}, body: {}, params: {}, tenantContext: { tenantId, source: "jwt-claims", resolvedAt: new Date() }, authContext: { source: "jwt-claims", authenticatedAt: new Date(), user: { id: "admin", permissions: ["academics.teaching-assignment.read", "academics.teaching-assignment.manage"], source: "jwt-claims" } } };
}
const input = { campusId: "campus_1", academicYearId: "year_1", employeeId: "employee_1", employeeName: "Ananya Rao", role: "SUBJECT_TEACHER", programId: "program_1", classId: "class_1", sectionId: "section_1", subjectId: "subject_1" };
test("creates and lists a tenant-isolated subject-teacher assignment", async () => {
  const repository = new InMemoryTeachingAssignmentRepository();
  const created = await createTeachingAssignment(input, context(), { repository });
  assert.equal(created.employeeName, "Ananya Rao");
  assert.equal((await listTeachingAssignments(context(), { campusId: "campus_1", academicYearId: "year_1" }, { repository })).length, 1);
  assert.equal((await listTeachingAssignments(context("tenant_two"), { campusId: "campus_1" }, { repository })).length, 0);
});
test("allows only one active in-charge per section and supports deactivation", async () => {
  const repository = new InMemoryTeachingAssignmentRepository();
  const first = await createTeachingAssignment({ ...input, role: "SECTION_INCHARGE", subjectId: undefined }, context(), { repository });
  await assert.rejects(() => createTeachingAssignment({ ...input, employeeId: "employee_2", employeeName: "Kiran Rao", role: "SECTION_INCHARGE", subjectId: undefined }, context(), { repository }), /section already has/);
  assert.equal((await deactivateTeachingAssignment(first.id, context(), { repository })).status, "INACTIVE");
});
