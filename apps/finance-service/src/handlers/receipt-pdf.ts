import type { RequestContext } from "@school-erp/api";
import { normalizePermissions } from "@school-erp/auth";
import { ForbiddenError, ValidationError, toErrorResponse } from "@school-erp/errors";
import { getReceiptDocument } from "../modules/payments/payments.service";
import { paymentPermissions } from "../modules/payments/payments.permissions";
import { hydrateFinanceRuntimeConfig } from "./runtime-config";

interface HttpApiEvent {
  pathParameters?: { paymentId?: string };
  queryStringParameters?: { copies?: string };
  requestContext?: {
    requestId?: string;
    http?: { method?: string; path?: string };
    authorizer?: { jwt?: { claims?: Record<string, unknown> } };
  };
}

function claim(claims: Record<string, unknown>, name: string): string | undefined {
  const value = claims[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function requestContext(event: HttpApiEvent): RequestContext {
  const claims = event.requestContext?.authorizer?.jwt?.claims ?? {};
  const userId = claim(claims, "sub");
  const tenantId = claim(claims, "custom:tenantId");
  if (!userId || !tenantId) throw new ForbiddenError("authenticated tenant identity is required");
  const role = claim(claims, "custom:role") ?? claim(claims, "cognito:groups");
  const permissions = normalizePermissions([
    ...(role?.includes("TENANT_ADMIN") ? [paymentPermissions.readReceipt] : []),
    ...normalizePermissions(claims["custom:permissions"] ?? claims.permissions),
  ]);
  return {
    requestId: event.requestContext?.requestId ?? `receipt_${crypto.randomUUID()}`,
    path: event.requestContext?.http?.path ?? "/v1/payments/:paymentId/receipt.pdf",
    method: "GET",
    headers: {},
    query: {},
    body: undefined,
    params: event.pathParameters ?? {},
    tenantContext: { tenantId, source: "jwt-claims", resolvedAt: new Date() },
    authContext: {
      source: "jwt-claims",
      authenticatedAt: new Date(),
      user: { id: userId, role, permissions, source: "jwt-claims" },
    },
  };
}

export async function handler(event: HttpApiEvent) {
  const traceId = event.requestContext?.requestId;
  try {
    await hydrateFinanceRuntimeConfig();
    const paymentId = event.pathParameters?.paymentId?.trim();
    if (!paymentId) throw new ValidationError([{ field: "paymentId", message: "paymentId is required" }]);
    const copyMode = event.queryStringParameters?.copies === "both" ? "BOTH" : "STUDENT";
    const document = await getReceiptDocument(paymentId, requestContext(event), undefined, copyMode);
    return {
      statusCode: 200,
      headers: {
        "content-type": document.contentType,
        "content-disposition": `attachment; filename="${document.fileName}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
      body: bytesToBase64(document.bytes),
      isBase64Encoded: true,
    };
  } catch (error) {
    const response = toErrorResponse(error, traceId);
    return {
      statusCode: response.statusCode,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
      body: JSON.stringify(response.body),
    };
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}
