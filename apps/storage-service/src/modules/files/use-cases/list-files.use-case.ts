import type { FileServiceContext } from "../files.model";
import type { StorageServiceDeps } from "../files.service";
import { listFiles } from "../files.service";

export async function listFilesUseCase(context: FileServiceContext, deps?: StorageServiceDeps, filter?: unknown) {
  return listFiles(context, deps, filter);
}
