import type { FileServiceContext } from "../files.model";
import type { StorageServiceDeps } from "../files.service";
import { getFile } from "../files.service";

export async function getFileUseCase(id: string, context: FileServiceContext, deps?: StorageServiceDeps) {
  return getFile(id, context, deps);
}
