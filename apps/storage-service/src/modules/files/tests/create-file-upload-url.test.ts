import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryFileRepository } from "../files.repository";
import {
  completeFileUploadUseCase,
  createFileDownloadUrlUseCase,
  createFileUploadUrlUseCase,
  deleteFileUseCase,
} from "../use-cases";
import { createStorageContext } from "./fixtures";

test("create file upload url stores pending metadata", async () => {
  const repository = new InMemoryFileRepository();
  const result = await createFileUploadUrlUseCase(
    {
      tenantId: "tenant_1",
      fileName: "admission-form.pdf",
      contentType: "application/pdf",
      scopeType: "TENANT",
      metadata: {
        documentType: "IDENTITY",
        documentLabel: "Identity proof",
      },
    },
    createStorageContext(),
    { repository },
  );

  assert.equal(result.file.status, "PENDING_UPLOAD");
  assert.equal(result.file.metadata?.documentType, "IDENTITY");
  assert.match(result.uploadUrl, /https:\/\/storage\.local\/upload\//);
});

test("staff can manage only their own profile photo without general file permissions", async () => {
  const repository = new InMemoryFileRepository();
  const staffContext = createStorageContext();
  staffContext.authContext!.user!.id = "teacher-user";
  staffContext.authContext!.user!.role = "TEACHER";
  staffContext.authContext!.user!.permissions = [];

  const created = await createFileUploadUrlUseCase(
    {
      fileName: "portrait.png",
      contentType: "image/png",
      sizeBytes: 2048,
      scopeType: "TENANT",
      metadata: { category: "staff_profile", employeeId: "employee-1" },
    },
    staffContext,
    { repository },
  );
  assert.equal(created.file.metadata?.ownerUserId, "teacher-user");

  const completed = await completeFileUploadUseCase(created.file.id, staffContext, { repository });
  assert.equal(completed?.status, "AVAILABLE");
  const download = await createFileDownloadUrlUseCase(created.file.id, {}, staffContext, {
    repository,
  });
  assert.match(download?.downloadUrl ?? "", /storage\.local\/download/);
  assert.equal(await deleteFileUseCase(created.file.id, staffContext, { repository }), true);

  await assert.rejects(
    createFileUploadUrlUseCase(
      {
        fileName: "records.pdf",
        contentType: "application/pdf",
        sizeBytes: 2048,
        scopeType: "TENANT",
      },
      staffContext,
      { repository },
    ),
    /permission denied/,
  );
});

test("profile photo self service rejects oversized images", async () => {
  const repository = new InMemoryFileRepository();
  const staffContext = createStorageContext();
  staffContext.authContext!.user!.permissions = [];

  await assert.rejects(
    createFileUploadUrlUseCase(
      {
        fileName: "portrait.png",
        contentType: "image/png",
        sizeBytes: 5 * 1024 * 1024 + 1,
        scopeType: "TENANT",
        metadata: { category: "staff_profile" },
      },
      staffContext,
      { repository },
    ),
    /permission denied/,
  );
});
