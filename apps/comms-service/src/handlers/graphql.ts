import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  toGraphqlError,
} from "@school-erp/errors";
import { listSesDeliveryEvents } from "../modules/delivery-events/delivery-events.service";
import { hydrateCommsRuntimeConfig } from "./runtime-config";

interface Event {
  info: { fieldName: string };
  arguments?: Record<string, unknown>;
  identity?: { claims?: Record<string, unknown> } | null;
  request?: { headers?: Record<string, string> };
}
function isSuperAdmin(event: Event) {
  const claims = event.identity?.claims ?? {};
  const groups = claims["cognito:groups"];
  const values = Array.isArray(groups)
    ? groups
    : typeof groups === "string"
      ? groups.split(",")
      : [];
  return (
    claims["custom:role"] === "SUPER_ADMIN" || values.includes("SUPER_ADMIN")
  );
}
export async function handleCommsGraphql(event: Event) {
  if (!isSuperAdmin(event))
    throw new ForbiddenError("platform administrator access is required");
  if (event.info.fieldName !== "inviteDeliveryEvents")
    throw new NotFoundError(
      `unsupported comms GraphQL field: ${event.info.fieldName}`,
    );
  const email = event.arguments?.email;
  if (typeof email !== "string") throw new BadRequestError("email is required");
  return listSesDeliveryEvents(email);
}
export async function handler(event: Event) {
  try {
    await hydrateCommsRuntimeConfig();
    return await handleCommsGraphql(event);
  } catch (error) {
    throw toGraphqlError(error, event.request?.headers?.["x-amzn-trace-id"]);
  }
}
