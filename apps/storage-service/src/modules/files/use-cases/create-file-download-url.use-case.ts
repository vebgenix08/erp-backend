import type { FileServiceContext } from "../files.model";
import type { StorageServiceDeps } from "../files.service";
import { createFileDownloadUrl } from "../files.service";

export async function createFileDownloadUrlUseCase(id: string, input: unknown, context: FileServiceContext, deps?: StorageServiceDeps) {
  return createFileDownloadUrl(id, input, context, deps);
}
