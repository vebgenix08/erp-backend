import type { RequestContext } from "@school-erp/api";

export type FileStatus = "PENDING_UPLOAD" | "AVAILABLE" | "DELETED";
export type FileScopeType = "TENANT" | "CAMPUS" | "ACADEMIC_YEAR" | "CLASS" | "SECTION" | "STUDENT" | "PUBLIC";

export interface FileRecord {
  id: string;
  tenantId: string;
  scopeType: FileScopeType;
  scopeId?: string | undefined;
  fileName: string;
  contentType: string;
  sizeBytes?: number | undefined;
  metadata?: Record<string, string> | undefined;
  storageKey: string;
  bucket: string;
  status: FileStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  uploadedAt?: Date | undefined;
  deletedAt?: Date | undefined;
}

export interface FileView {
  id: string;
  tenantId: string;
  scopeType: FileScopeType;
  scopeId?: string | undefined;
  fileName: string;
  contentType: string;
  sizeBytes?: number | undefined;
  metadata?: Record<string, string> | undefined;
  storageKey: string;
  bucket: string;
  status: FileStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  uploadedAt?: string | undefined;
  deletedAt?: string | undefined;
}

export interface FileCreateUploadInput {
  scopeType?: FileScopeType | undefined;
  scopeId?: string | undefined;
  fileName: string;
  contentType: string;
  sizeBytes?: number | undefined;
  metadata?: Record<string, string> | undefined;
}

export interface FileDownloadUrlInput {
  expiresInSeconds?: number | undefined;
}

export interface FileUploadUrlResponse {
  file: FileView;
  uploadUrl: string;
  expiresAt: string;
  headers?: Record<string, string> | undefined;
}

export interface FileDownloadUrlResponse {
  file: FileView;
  downloadUrl: string;
  expiresAt: string;
}

export interface FileListFilter {
  status?: FileStatus | undefined;
  scopeType?: FileScopeType | undefined;
  scopeId?: string | undefined;
  search?: string | undefined;
}

export interface FileServiceContext {
  requestId: string;
  tenantContext: RequestContext["tenantContext"];
  authContext: RequestContext["authContext"];
}
