import type { RequestContext } from "@school-erp/api";
import { completeFirstAdminBootstrap } from "../modules/bootstrap/bootstrap.service";
import type { FirstAdminBootstrapServiceDeps } from "../modules/bootstrap/bootstrap.service";
import { hydratePlatformRuntimeConfig } from "./runtime-config";

interface CognitoPostAuthenticationEvent {
  request: { userAttributes?: Record<string, string | undefined> };
  userName?: string;
}

export async function handlePostAuthentication<T extends CognitoPostAuthenticationEvent>(event: T, deps?: FirstAdminBootstrapServiceDeps): Promise<T> {
  const attributes = event.request.userAttributes ?? {};
  const role = attributes["custom:role"];
  const tenantId = attributes["custom:tenantId"]?.trim();
  if (role !== "TENANT_ADMIN" || !tenantId) return event;

  const context: RequestContext = {
    requestId: `cognito_post_auth_${crypto.randomUUID()}`,
    path: "cognito:post-authentication",
    method: "POST",
    headers: {},
    query: {},
    params: {},
    body: undefined,
    authContext: {
      source: "jwt-claims",
      authenticatedAt: new Date(),
      user: {
        id: attributes.sub ?? event.userName ?? "unknown",
        email: attributes.email,
        role: "SUPER_ADMIN",
        permissions: ["platform.bootstrap.complete"],
        source: "jwt-claims",
      },
    },
  };
  await completeFirstAdminBootstrap(tenantId, { inviteId: event.userName }, context, deps);
  return event;
}

export async function handler<T extends CognitoPostAuthenticationEvent>(event: T): Promise<T> {
  const attributes = event.request.userAttributes ?? {};
  if (attributes["custom:role"] === "TENANT_ADMIN" && attributes["custom:tenantId"]?.trim()) {
    await hydratePlatformRuntimeConfig();
  }
  return handlePostAuthentication(event);
}
