import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryFileRepository } from "../files.repository";
import { completeFileUploadUseCase, createFileUploadUrlUseCase, deleteFileUseCase, getFileUseCase } from "../use-cases";
import { createStorageContext } from "./fixtures";

test("delete file soft deletes the record", async () => {
  const repository = new InMemoryFileRepository();
  const created = await createFileUploadUrlUseCase(
    { tenantId: "tenant_1", fileName: "doc.pdf", contentType: "application/pdf" },
    createStorageContext(),
    { repository },
  );
  await completeFileUploadUseCase(created.file.id, createStorageContext(), { repository });
  const deleted = await deleteFileUseCase(created.file.id, createStorageContext(), { repository });
  const fetched = await getFileUseCase(created.file.id, createStorageContext(), { repository });

  assert.equal(deleted, true);
  assert.equal(fetched?.status, "DELETED");
});
