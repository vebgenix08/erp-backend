import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryFileRepository } from "../files.repository";
import { completeFileUploadUseCase, createFileUploadUrlUseCase } from "../use-cases";
import { createStorageContext } from "./fixtures";
import { InMemoryStorageUrlPort } from "../files.service";

test("complete file upload marks file available", async () => {
  const repository = new InMemoryFileRepository();
  const created = await createFileUploadUrlUseCase(
    { tenantId: "tenant_1", fileName: "doc.pdf", contentType: "application/pdf" },
    createStorageContext(),
    { repository },
  );

  const completed = await completeFileUploadUseCase(created.file.id, createStorageContext(), {
    repository,
  });
  assert.equal(completed?.status, "AVAILABLE");
});

test("failed object verification leaves the upload pending", async () => {
  const repository = new InMemoryFileRepository();
  const created = await createFileUploadUrlUseCase(
    { fileName: "photo.png", contentType: "image/png", sizeBytes: 100 },
    createStorageContext(),
    { repository },
  );
  const urlPort = new InMemoryStorageUrlPort();
  urlPort.verifyUpload = async () => {
    throw new Error("uploaded file size does not match");
  };
  await assert.rejects(
    completeFileUploadUseCase(created.file.id, createStorageContext(), { repository, urlPort }),
    /size does not match/,
  );
  assert.equal((await repository.getById("tenant_1", created.file.id))?.status, "PENDING_UPLOAD");
});
