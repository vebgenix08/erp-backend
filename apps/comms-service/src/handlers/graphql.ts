import { BadRequestError, ForbiddenError, NotFoundError, toGraphqlError } from "@school-erp/errors";
import { listSesDeliveryEvents } from "../modules/delivery-events/delivery-events.service";
import { hydrateCommsRuntimeConfig } from "./runtime-config";

interface Event {
  info: { fieldName: string };
  arguments?: Record<string, unknown>;
  identity?: { claims?: Record<string, unknown> } | null;
  request?: { headers?: Record<string, string> };
  source?: string;
  operation?: string;
  payload?: Record<string, unknown>;
}
function isSuperAdmin(event: Event) {
  const claims = event.identity?.claims ?? {};
  const groups = claims["cognito:groups"];
  const values = Array.isArray(groups)
    ? groups
    : typeof groups === "string"
      ? groups.split(",")
      : [];
  return claims["custom:role"] === "SUPER_ADMIN" || values.includes("SUPER_ADMIN");
}
export async function handleCommsGraphql(event: Event) {
  if (!isSuperAdmin(event)) throw new ForbiddenError("platform administrator access is required");
  if (event.info.fieldName !== "inviteDeliveryEvents")
    throw new NotFoundError(`unsupported comms GraphQL field: ${event.info.fieldName}`);
  const email = event.arguments?.email;
  if (typeof email !== "string") throw new BadRequestError("email is required");
  return listSesDeliveryEvents(email);
}
export async function handler(event: Event) {
  try {
    await hydrateCommsRuntimeConfig();
    if (event.source === "erp.internal" && event.operation === "LIST_EMAIL_DELIVERY_EVENTS") {
      const email = event.payload?.email;
      const tenantId = event.payload?.tenantId;
      if (typeof email !== "string") throw new BadRequestError("email is required");
      if (typeof tenantId !== "string" || !tenantId.trim())
        throw new BadRequestError("tenantId is required");
      const limit = Math.min(100, Math.max(1, Number(event.payload?.limit ?? 50)));
      const records = await listSesDeliveryEvents(email, tenantId);
      return { result: records.slice(0, limit) };
    }
    return await handleCommsGraphql(event);
  } catch (error) {
    throw toGraphqlError(error, event.request?.headers?.["x-amzn-trace-id"]);
  }
}
