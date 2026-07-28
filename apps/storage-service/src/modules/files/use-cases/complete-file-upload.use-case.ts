import type { FileServiceContext } from "../files.model";
import type { StorageServiceDeps } from "../files.service";
import { completeFileUpload } from "../files.service";

export async function completeFileUploadUseCase(id: string, context: FileServiceContext, deps?: StorageServiceDeps) {
  return completeFileUpload(id, context, deps);
}
