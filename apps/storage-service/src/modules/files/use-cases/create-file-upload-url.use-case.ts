import type { FileServiceContext } from "../files.model";
import type { StorageServiceDeps } from "../files.service";
import { createFileUploadUrl } from "../files.service";

export async function createFileUploadUrlUseCase(input: unknown, context: FileServiceContext, deps?: StorageServiceDeps) {
  return createFileUploadUrl(input, context, deps);
}
