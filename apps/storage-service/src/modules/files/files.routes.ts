import type { ApiRouter, RequestContext } from "@school-erp/api";
import { jsonResponse } from "@school-erp/api";
import type { StorageServiceDeps } from "./files.service";
import { completeFileUpload, createFileDownloadUrl, createFileUploadUrl, deleteFile, getFile, listFiles } from "./files.service";
import { validateFileDownloadUrlInput, validateFileListFilter } from "./files.validator";

function fileId(context: RequestContext): string {
  return context.params.id ?? "";
}

export function registerStorageRoutes(router: ApiRouter, deps: StorageServiceDeps = {}): ApiRouter {
  router.route("GET", "/files", async (context: RequestContext) => {
    const result = await listFiles(context, deps, validateFileListFilter(context.query));
    return jsonResponse(200, result);
  });

  router.route("GET", "/files/:id", async (context: RequestContext) => {
    const result = await getFile(fileId(context), context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "file not found" });
  });

  router.route("POST", "/files/upload-url", async (context: RequestContext) => {
    const result = await createFileUploadUrl(context.body, context, deps);
    return jsonResponse(201, result);
  });

  router.route("POST", "/files/:id/complete-upload", async (context: RequestContext) => {
    const result = await completeFileUpload(fileId(context), context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "file not found" });
  });

  router.route("POST", "/files/:id/download-url", async (context: RequestContext) => {
    const result = await createFileDownloadUrl(fileId(context), context.body ? validateFileDownloadUrlInput(context.body) : {}, context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "file not found" });
  });

  router.route("DELETE", "/files/:id", async (context: RequestContext) => {
    const result = await deleteFile(fileId(context), context, deps);
    return jsonResponse(result ? 204 : 404, result ? undefined : { message: "file not found" });
  });

  return router;
}
