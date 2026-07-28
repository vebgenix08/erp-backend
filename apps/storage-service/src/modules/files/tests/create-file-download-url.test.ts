import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryFileRepository } from "../files.repository";
import { createFileDownloadUrlUseCase, completeFileUploadUseCase, createFileUploadUrlUseCase } from "../use-cases";
import { createStorageContext } from "./fixtures";

test("create file download url requires available file", async () => {
  const repository = new InMemoryFileRepository();
  const created = await createFileUploadUrlUseCase(
    { tenantId: "tenant_1", fileName: "doc.pdf", contentType: "application/pdf" },
    createStorageContext(),
    { repository },
  );
  await completeFileUploadUseCase(created.file.id, createStorageContext(), { repository });
  const downloaded = await createFileDownloadUrlUseCase(created.file.id, {}, createStorageContext(), { repository });

  assert.equal(downloaded?.file.status, "AVAILABLE");
  assert.match(downloaded?.downloadUrl ?? "", /https:\/\/storage\.local\/download\//);
});
