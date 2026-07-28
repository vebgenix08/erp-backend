import { filePermissions } from "../modules/files/files.permissions";
import { createS3StorageUrlPort } from "../modules/files/s3-storage-url.port";
import { createStorageApp } from "../app";
import { hydrateStorageRuntimeConfig } from "./runtime-config";

interface HttpApiEvent {
  rawPath?: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
  requestContext?: {
    requestId?: string;
    http?: { method?: string; path?: string };
    authorizer?: { jwt?: { claims?: Record<string, string | undefined> } };
  };
}

function parseQuery(raw?: string): Record<string, string> {
  if (!raw) return {};
  return Object.fromEntries(new URLSearchParams(raw));
}

function parseBody(event: HttpApiEvent): unknown {
  if (!event.body) return undefined;
  const text = event.isBase64Encoded
    ? decodeURIComponent(
        Array.from(atob(event.body), (character) =>
          `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`,
        ).join(""),
      )
    : event.body;
  return JSON.parse(text);
}

function claims(event: HttpApiEvent): Record<string, string | undefined> {
  return event.requestContext?.authorizer?.jwt?.claims ?? {};
}

export async function handler(event: HttpApiEvent) {
  try {
    await hydrateStorageRuntimeConfig();
    const identity = claims(event);
    const tenantId = identity["custom:tenantId"]?.trim();
    const userId = identity.sub?.trim();
    if (!tenantId || !userId) {
      return { statusCode: 403, headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "tenant identity is required" }) };
    }
    const role = identity["custom:role"] || identity["cognito:groups"];
    const permissions = role?.includes("TENANT_ADMIN") ? Object.values(filePermissions) : [];
    const router = createStorageApp({
      urlPort: createS3StorageUrlPort(),
      documentsBucketName: runtimeEnv().DOCUMENTS_BUCKET_NAME,
    });
    const response = await router.handle({
      requestId: event.requestContext?.requestId,
      method: event.requestContext?.http?.method ?? "GET",
      path: event.rawPath ?? event.requestContext?.http?.path ?? "/",
      headers: event.headers,
      query: parseQuery(event.rawQueryString),
      body: parseBody(event),
      tenantContext: { tenantId, source: "jwt-claims", resolvedAt: new Date() },
      authContext: {
        source: "jwt-claims",
        authenticatedAt: new Date(),
        user: {
          id: userId,
          email: identity.email,
          role,
          permissions,
          source: "jwt-claims",
        },
      },
    });
    return {
      statusCode: response.statusCode,
      headers: { "content-type": "application/json", ...(response.headers as Record<string, string> | undefined) },
      body: response.body === undefined ? "" : JSON.stringify(response.body),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "internal error";
    return { statusCode: 500, headers: { "content-type": "application/json" }, body: JSON.stringify({ message }) };
  }
}

function runtimeEnv(): Record<string, string | undefined> {
  return (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
}
