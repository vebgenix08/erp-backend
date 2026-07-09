import test from "node:test";
import assert from "node:assert/strict";
import { createTenantContext } from "@school-erp/tenancy";
import {
  hasPermission,
  requireAuth,
  requirePermission,
  resolveAuthFromRequest,
} from "../index";

test("resolves auth from jwt claims first", () => {
  const context = resolveAuthFromRequest({
    jwtClaims: {
      sub: "user-1",
      email: "principal@example.com",
      role: "ADMIN",
      permissions: ["platform.tenant.create", "academics.student.read"],
      tenantId: "tenant-1",
    },
    headers: {
      "x-user-id": "user-header",
      "x-tenant-id": "tenant-header",
    },
  });

  assert.equal(context.source, "jwt-claims");
  assert.equal(context.user?.id, "user-1");
  assert.equal(context.user?.email, "principal@example.com");
  assert.equal(context.tenant?.tenantId, "tenant-1");
});

test("resolves auth from local headers", () => {
  const context = resolveAuthFromRequest({
    headers: {
      "x-user-id": "user-local",
      "x-user-email": "local@example.com",
      "x-user-role": "teacher",
      "x-user-permissions": "academics.student.create, finance.payment.collect",
      "x-tenant-id": "tenant-local",
    },
  });

  assert.equal(context.source, "headers");
  assert.equal(context.user?.id, "user-local");
  assert.equal(context.user?.email, "local@example.com");
  assert.equal(context.user?.role, "TEACHER");
  assert.equal(context.tenant?.tenantId, "tenant-local");
  assert.equal(hasPermission(context, "academics.student.create"), true);
  assert.equal(hasPermission(context, "finance.payment.collect"), true);
});

test("requireAuth rejects missing user", () => {
  assert.throws(() => requireAuth(resolveAuthFromRequest()), /authentication is required/i);
});

test("requirePermission enforces permission checks", () => {
  const context = resolveAuthFromRequest({
    headers: {
      "x-user-id": "user-local",
      "x-user-permissions": "platform.tenant.create",
      "x-tenant-id": "tenant-local",
    },
  });

  assert.doesNotThrow(() => requirePermission(context, "platform.tenant.create"));
  assert.throws(() => requirePermission(context, "platform.tenant.delete"), /missing permission/i);
});

test("auth context can be combined with tenant context", () => {
  const context = resolveAuthFromRequest({
    headers: {
      "x-user-id": "user-local",
      "x-user-permissions": "platform.tenant.create",
      "x-tenant-id": "tenant-local",
    },
  });

  const tenantContext = createTenantContext({ source: "request", tenantId: context.tenant?.tenantId, tenantCode: "TENANT-LOCAL" });
  assert.equal(tenantContext.tenantId, "tenant-local");
});
