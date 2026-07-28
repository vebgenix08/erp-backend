import type { FileServiceContext } from "../files.model";
import type { StorageServiceDeps } from "../files.service";
import { deleteFile } from "../files.service";

export async function deleteFileUseCase(id: string, context: FileServiceContext, deps?: StorageServiceDeps) {
  return deleteFile(id, context, deps);
}
