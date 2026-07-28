import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryFileRepository } from "../files.repository";
import { createFileUploadUrlUseCase, listFilesUseCase } from "../use-cases";
import { createStorageContext } from "./fixtures";

test("list files filters by scope", async () => {
  const repository = new InMemoryFileRepository();
  await createFileUploadUrlUseCase(
    { tenantId: "tenant_1", fileName: "doc.pdf", contentType: "application/pdf", scopeType: "TENANT" },
    createStorageContext(),
    { repository },
  );
  const results = await listFilesUseCase(createStorageContext(), { repository }, { scopeType: "TENANT" });
  assert.equal(results.length, 1);
});

test("list files isolates records by student scope id", async () => {
  const repository = new InMemoryFileRepository();
  await createFileUploadUrlUseCase({ fileName: "student-one.pdf", contentType: "application/pdf", scopeType: "STUDENT", scopeId: "student_1" }, createStorageContext(), { repository });
  await createFileUploadUrlUseCase({ fileName: "student-two.pdf", contentType: "application/pdf", scopeType: "STUDENT", scopeId: "student_2" }, createStorageContext(), { repository });
  const results = await listFilesUseCase(createStorageContext(), { repository }, { scopeType: "STUDENT", scopeId: "student_1" });
  assert.equal(results.length, 1);
  assert.equal(results[0]?.scopeId, "student_1");
});
