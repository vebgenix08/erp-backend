import { createRouter, type ApiRouter } from "@school-erp/api";
import { registerInviteEmailRoutes } from "../modules/invite-email/invite-email.routes";

export function registerCommsRoutes(router: ApiRouter): ApiRouter {
  registerInviteEmailRoutes(router);
  return router;
}

export function createCommsRouter(): ApiRouter {
  const router = createRouter();
  registerCommsRoutes(router);
  return router;
}

export const commsRouter = createCommsRouter();
