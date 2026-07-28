import test from "node:test";
import assert from "node:assert/strict";
import type { RequestContext } from "@school-erp/api";
import { createStudentNote, listStudentNotes, updateStudentNote } from "../student-notes.service";
import { InMemoryStudentNoteRepository } from "../student-notes.repository";

const context = (tenantId: string): RequestContext => ({
  requestId: "request_student_notes",
  method: "POST",
  path: "graphql:studentNotes",
  headers: {},
  query: {},
  body: {},
  params: {},
  tenantContext: { tenantId, source: "jwt-claims", resolvedAt: new Date() },
  authContext: {
    source: "jwt-claims",
    authenticatedAt: new Date(),
    user: { id: "user_administrator", source: "jwt-claims", permissions: [] },
  },
});

test("student notes are tenant isolated and can be updated", async () => {
  const repository = new InMemoryStudentNoteRepository();
  const created = await createStudentNote(
    "student_aarav",
    { body: "Parent requested an academic counselling meeting." },
    context("tenant_greenfield"),
    repository,
  );
  const updated = await updateStudentNote(
    created.id,
    { body: "Academic counselling meeting completed." },
    context("tenant_greenfield"),
    repository,
  );

  assert.equal(updated.body, "Academic counselling meeting completed.");
  assert.equal((await listStudentNotes("student_aarav", context("tenant_greenfield"), repository)).length, 1);
  assert.equal((await listStudentNotes("student_aarav", context("tenant_other"), repository)).length, 0);
});
