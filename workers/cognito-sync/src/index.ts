import type { RequestContext } from "@school-erp/api";
import type { activateEmployeeLogin, EmployeeServiceDeps } from "@school-erp/identity-service";
import type { completeFirstAdminBootstrap, FirstAdminBootstrapServiceDeps } from "@school-erp/platform-service";

export interface CognitoPostAuthenticationEvent {
  request: { userAttributes?: Record<string, string | undefined> };
  userName?: string;
}

export interface AuthLifecycleDeps {
  completeBootstrap?: typeof completeFirstAdminBootstrap;
  activateEmployee?: typeof activateEmployeeLogin;
  bootstrapDeps?: FirstAdminBootstrapServiceDeps;
  employeeDeps?: EmployeeServiceDeps;
}

function requestContext(event: CognitoPostAuthenticationEvent): RequestContext {
  const attributes = event.request.userAttributes ?? {};
  return {
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
}

export async function handlePostAuthentication<T extends CognitoPostAuthenticationEvent>(
  event: T,
  deps: AuthLifecycleDeps = {},
): Promise<T> {
  const attributes = event.request.userAttributes ?? {};
  const tenantId = attributes["custom:tenantId"]?.trim();
  const email = attributes.email?.trim().toLowerCase();
  if (!tenantId) return event;

  if (attributes["custom:role"] === "TENANT_ADMIN") {
    const completeBootstrap = deps.completeBootstrap ?? (await import("@school-erp/platform-service")).completeFirstAdminBootstrap;
    await completeBootstrap(
      tenantId,
      { inviteId: event.userName },
      requestContext(event),
      deps.bootstrapDeps,
    );
  }
  if (email) {
    const activateEmployee = deps.activateEmployee ?? (await import("@school-erp/identity-service")).activateEmployeeLogin;
    await activateEmployee(tenantId, email, deps.employeeDeps);
  }
  return event;
}

export async function handler<T extends CognitoPostAuthenticationEvent>(event: T): Promise<T> {
  const attributes = event.request.userAttributes ?? {};
  if (!attributes["custom:tenantId"]?.trim()) return event;
  const [platform, identity] = await Promise.all([import("@school-erp/platform-service"), import("@school-erp/identity-service")]);
  await Promise.all([platform.hydratePlatformRuntimeConfig(), identity.hydrateIdentityRuntimeConfig()]);
  return handlePostAuthentication(event);
}
