import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryFileRepository } from "../files.repository";
import {
  createFileDownloadUrlUseCase,
  completeFileUploadUseCase,
  createFileUploadUrlUseCase,
} from "../use-cases";
import { createStorageContext } from "./fixtures";

test("create file download url requires available file", async () => {
  const repository = new InMemoryFileRepository();
  const created = await createFileUploadUrlUseCase(
    { tenantId: "tenant_1", fileName: "doc.pdf", contentType: "application/pdf" },
    createStorageContext(),
    { repository },
  );
  await completeFileUploadUseCase(created.file.id, createStorageContext(), { repository });
  const downloaded = await createFileDownloadUrlUseCase(
    created.file.id,
    {},
    createStorageContext(),
    { repository },
  );

  assert.equal(downloaded?.file.status, "AVAILABLE");
  assert.match(downloaded?.downloadUrl ?? "", /https:\/\/storage\.local\/download\//);
});

test("tenant members can download the institution logo without general file access", async () => {
  const repository = new InMemoryFileRepository();
  const adminContext = createStorageContext();
  const created = await createFileUploadUrlUseCase(
    {
      fileName: "institution.png",
      contentType: "image/png",
      sizeBytes: 1024,
      scopeType: "TENANT",
      metadata: { category: "institution_logo" },
    },
    adminContext,
    { repository },
  );
  await completeFileUploadUseCase(created.file.id, adminContext, { repository });
  const memberContext = createStorageContext();
  memberContext.authContext!.user!.id = "tenant-member";
  memberContext.authContext!.user!.role = "TEACHER";
  memberContext.authContext!.user!.permissions = [];

  const downloaded = await createFileDownloadUrlUseCase(created.file.id, {}, memberContext, {
    repository,
  });
  assert.match(downloaded?.downloadUrl ?? "", /storage\.local\/download/);
});
