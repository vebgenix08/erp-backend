import test from "node:test";
import assert from "node:assert/strict";
import {
  createTenantContext,
  getTenantCodeFromHeaders,
  getTenantIdFromHeaders,
  getTenantSubdomain,
  hasTenantCode,
  hasTenantId,
  requireTenant,
  requireTenantCode,
  requireTenantId,
  resolveTenantFromRequest,
} from "../index";

test("resolves tenant from jwt claims first", () => {
  const context = resolveTenantFromRequest({
    jwtClaims: { tenantId: "tenant-jwt", tenantCode: "JWT-001" },
    headers: {
      "x-tenant-id": "tenant-header",
      "x-tenant-code": "header-code",
    },
    hostname: "school.example.com",
  });

  assert.equal(context.source, "jwt-claims");
  assert.equal(context.tenantId, "tenant-jwt");
  assert.equal(context.tenantCode, "JWT-001");
});

test("falls back to x-tenant-id header", () => {
  const context = resolveTenantFromRequest({
    headers: { "x-tenant-id": "tenant-header" },
  });

  assert.equal(context.source, "x-tenant-id");
  assert.equal(context.tenantId, "tenant-header");
});

test("falls back to x-tenant-code header", () => {
  const context = resolveTenantFromRequest({
    headers: { "x-tenant-code": "code-123" },
  });

  assert.equal(context.source, "x-tenant-code");
  assert.equal(context.tenantCode, "CODE-123");
});

test("falls back to subdomain placeholder", () => {
  const context = resolveTenantFromRequest({
    hostname: "alpha.school.example.com",
  });

  assert.equal(context.source, "subdomain");
  assert.equal(context.tenantCode, "alpha");
});

test("requireTenant and helpers validate presence", () => {
  const context = createTenantContext({ source: "request", tenantId: "tenant-1", tenantCode: "T-1" });

  assert.equal(requireTenant(context).tenantId, "tenant-1");
  assert.equal(requireTenantId(context), "tenant-1");
  assert.equal(requireTenantCode(context), "T-1");
  assert.equal(hasTenantId(context), true);
  assert.equal(hasTenantCode(context), true);
});

test("header helper readers normalize values", () => {
  assert.equal(getTenantIdFromHeaders({ headers: { "x-tenant-id": "  tenant-a  " } }), "tenant-a");
  assert.equal(getTenantCodeFromHeaders({ headers: { "x-tenant-code": " school-1 " } }), "SCHOOL-1");
  assert.equal(getTenantSubdomain({ hostname: "tenant.example.com" }), "tenant");
});

test("requireTenant rejects missing tenantId", () => {
  assert.throws(() => requireTenant(createTenantContext({ source: "unknown" })), /tenant context is required/i);
});
