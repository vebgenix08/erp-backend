import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryFileRepository } from "../files.repository";
import { createFileUploadUrlUseCase } from "../use-cases";
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
