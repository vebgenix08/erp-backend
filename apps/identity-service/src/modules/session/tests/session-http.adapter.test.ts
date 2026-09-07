import test from "node:test";
import assert from "node:assert/strict";
import { toIdentityApiRequest, toHttpApiResponse } from "../session-http.adapter";

test("session HTTP adapter maps verified API Gateway JWT claims", () => {
  const request = toIdentityApiRequest({
    rawPath: "/session/me",
    headers: { authorization: "Bearer token" },
    requestContext: {
      requestId: "request_1",
      http: { method: "GET" },
      authorizer: {
        jwt: {
          claims: {
            sub: "user_1",
            email: "teacher@example.edu",
            "custom:tenantId": "tenant_1",
            "custom:role": "TEACHER",
          },
        },
      },
    },
  });

  assert.equal(request.path, "/session/me");
  assert.equal(request.authContext?.user?.id, "user_1");
  assert.equal(request.authContext?.user?.role, "TEACHER");
  assert.equal(request.tenantContext?.tenantId, "tenant_1");
});

test("session HTTP adapter serializes API responses for Lambda proxy", () => {
  assert.deepEqual(toHttpApiResponse({ statusCode: 200, body: { ok: true } }), {
    statusCode: 200,
    headers: undefined,
    body: '{"ok":true}',
  });
});
