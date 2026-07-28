import { jsonResponse, type ApiRouter, type RequestContext } from "@school-erp/api";
import { getNotificationPolicy, updateNotificationPolicy } from "./notification-policy.service";
export function registerNotificationPolicyRoutes(router: ApiRouter) { router.route("GET", "/notification-policy", async (context: RequestContext) => jsonResponse(200, await getNotificationPolicy(context))); router.route("PUT", "/notification-policy", async (context: RequestContext) => jsonResponse(200, await updateNotificationPolicy(context.body, context))); return router; }
