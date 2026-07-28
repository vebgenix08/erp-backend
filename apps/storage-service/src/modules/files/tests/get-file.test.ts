import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryFileRepository } from "../files.repository";
import { createFileUploadUrlUseCase, getFileUseCase } from "../use-cases";
import { createStorageContext } from "./fixtures";

test("get file returns tenant scoped metadata", async () => {
  const repository = new InMemoryFileRepository();
  const created = await createFileUploadUrlUseCase(
    { tenantId: "tenant_1", fileName: "doc.pdf", contentType: "application/pdf" },
    createStorageContext(),
    { repository },
  );
  const fetched = await getFileUseCase(created.file.id, createStorageContext(), { repository });
  assert.equal(fetched?.id, created.file.id);
});
