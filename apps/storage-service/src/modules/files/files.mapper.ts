import type { FileRecord, FileView } from "./files.model";

function iso(value: Date | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

export function toFileView(record: FileRecord | null): FileView | null {
  if (!record) return null;
  return {
    id: record.id,
    tenantId: record.tenantId,
    scopeType: record.scopeType,
    scopeId: record.scopeId,
    fileName: record.fileName,
    contentType: record.contentType,
    sizeBytes: record.sizeBytes,
    metadata: record.metadata ? { ...record.metadata } : undefined,
    storageKey: record.storageKey,
    bucket: record.bucket,
    status: record.status,
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    uploadedAt: iso(record.uploadedAt),
    deletedAt: iso(record.deletedAt),
  };
}
