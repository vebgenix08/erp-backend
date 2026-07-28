import { jsonResponse, type ApiRouter, type RequestContext } from "@school-erp/api";
import { getReceiptTemplate, saveReceiptTemplate } from "./receipt-template.service";
export function registerReceiptTemplateRoutes(router: ApiRouter) { router.route("GET", "/receipt-template", async (context: RequestContext) => jsonResponse(200, await getReceiptTemplate(context))); router.route("PUT", "/receipt-template", async (context: RequestContext) => jsonResponse(200, await saveReceiptTemplate(context.body, context))); return router; }
