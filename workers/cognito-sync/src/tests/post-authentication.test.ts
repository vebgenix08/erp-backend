import test from "node:test";
import assert from "node:assert/strict";
import { handlePostAuthentication } from "../index";

test("tenant administrator login completes bootstrap and activates matching employee", async () => {
  const calls: string[] = [];
  const event = {
    userName: "admin@example.com",
    request: { userAttributes: {
      sub: "auth-user-1",
      email: "Admin@Example.com",
      "custom:tenantId": "tenant_1",
      "custom:role": "TENANT_ADMIN",
    } },
  };

  const result = await handlePostAuthentication(event, {
    completeBootstrap: async (tenantId) => { calls.push(`bootstrap:${tenantId}`); return null; },
    activateEmployee: async (tenantId, email) => { calls.push(`employee:${tenantId}:${email}`); return null; },
  });

  assert.equal(result, event);
  assert.deepEqual(calls, ["bootstrap:tenant_1", "employee:tenant_1:admin@example.com"]);
});

test("staff login activates identity without completing tenant bootstrap", async () => {
  const calls: string[] = [];
  await handlePostAuthentication({
    userName: "teacher@example.com",
    request: { userAttributes: {
      email: "teacher@example.com",
      "custom:tenantId": "tenant_1",
      "custom:role": "TEACHER",
    } },
  }, {
    completeBootstrap: async () => { calls.push("bootstrap"); return null; },
    activateEmployee: async (_tenantId, email) => { calls.push(email); return null; },
  });
  assert.deepEqual(calls, ["teacher@example.com"]);
});

test("platform-only login performs no tenant writes", async () => {
  let called = false;
  const event = { request: { userAttributes: { email: "platform@example.com", "custom:role": "SUPER_ADMIN" } } };
  await handlePostAuthentication(event, {
    completeBootstrap: async () => { called = true; return null; },
    activateEmployee: async () => { called = true; return null; },
  });
  assert.equal(called, false);
});
