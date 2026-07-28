import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryFileRepository } from "../files.repository";
import { completeFileUploadUseCase, createFileUploadUrlUseCase } from "../use-cases";
import { createStorageContext } from "./fixtures";

test("complete file upload marks file available", async () => {
  const repository = new InMemoryFileRepository();
  const created = await createFileUploadUrlUseCase(
    { tenantId: "tenant_1", fileName: "doc.pdf", contentType: "application/pdf" },
    createStorageContext(),
    { repository },
  );

  const completed = await completeFileUploadUseCase(created.file.id, createStorageContext(), { repository });
  assert.equal(completed?.status, "AVAILABLE");
});
