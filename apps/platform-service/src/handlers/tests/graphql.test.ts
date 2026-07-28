import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryTenantRepository } from "../../modules/tenants/tenants.repository";
import { firstAdminInviteAuditAction, handlePlatformGraphql, type PlatformGraphqlEvent } from "../graphql";

function event(fieldName: string, args: Record<string, unknown> = {}, permissions: string[] = []): PlatformGraphqlEvent {
  return {
    info: { fieldName },
    arguments: args,
    identity: {
      sub: "platform_admin_test",
      claims: {
        "custom:role": "SUPER_ADMIN",
        "custom:permissions": permissions,
      },
    },
  };
}

test("platform GraphQL create is idempotent and list is paginated", async () => {
  const repository = new InMemoryTenantRepository();
  const createEvent = event("createTenant", {
    input: {
      clientRequestId: "request-1",
      name: "Alpha School",
      code: "ALPHA",
      type: "SCHOOL",
    },
  }, ["platform.tenants.create"]);

  const first = await handlePlatformGraphql(createEvent, { repository }) as { id: string };
  const repeated = await handlePlatformGraphql(createEvent, { repository }) as { id: string };
  assert.equal(repeated.id, first.id);

  const connection = await handlePlatformGraphql(
    event("tenants", { first: 1 }, ["platform.tenants.read"]),
    { repository },
  ) as { edges: Array<{ node: { id: string } }>; pageInfo: { hasNextPage: boolean } };
  assert.equal(connection.edges.length, 1);
  assert.equal(connection.edges[0]?.node.id, first.id);
  assert.equal(connection.pageInfo.hasNextPage, false);
});

test("platform GraphQL rejects a tenant admin even with a platform permission", async () => {
  const request = event("tenants", {}, ["platform.tenants.read"]);
  if (request.identity?.claims) request.identity.claims["custom:role"] = "TENANT_ADMIN";
  await assert.rejects(() => handlePlatformGraphql(request, { repository: new InMemoryTenantRepository() }), /platform administrator/i);
});

test("tenant user can read only the current tenant summary from JWT tenancy", async () => {
  const repository = new InMemoryTenantRepository();
  const tenant = await repository.create({
    clientRequestId: "tenant-summary-request",
    name: "Alpha School",
    code: "ALPHA",
    type: "SCHOOL",
  });
  const request = event("currentTenantSummary");
  if (request.identity?.claims) {
    request.identity.claims["custom:role"] = "TENANT_ADMIN";
    request.identity.claims["custom:tenantId"] = tenant.id;
  }

  const summary = await handlePlatformGraphql(request, { repository }) as { name: string; code: string };
  assert.equal(summary.name, "Alpha School");
  assert.equal(summary.code, "ALPHA");
});

test("platform GraphQL grants server-owned permissions to the Cognito SUPER_ADMIN group", async () => {
  const request = event("tenants");
  if (request.identity?.claims) {
    delete request.identity.claims["custom:role"];
    delete request.identity.claims["custom:permissions"];
    request.identity.claims["cognito:groups"] = ["SUPER_ADMIN"];
  }

  const result = await handlePlatformGraphql(request, {
    repository: new InMemoryTenantRepository(),
  }) as { edges: unknown[] };
  assert.equal(result.edges.length, 0);
});

test("platform GraphQL exposes real dashboard and feature module services", async () => {
  const repository = new InMemoryTenantRepository();
  const summary = await handlePlatformGraphql(event("platformDashboardSummary"), { repository }) as { tenantCount: number };
  const flags = await handlePlatformGraphql(event("platformFeatureFlags"), { repository }) as unknown[];
  assert.equal(summary.tenantCount, 0);
  assert.equal(flags.length, 0);
});

test("invite audit action distinguishes failed delivery from resend success", () => {
  assert.equal(firstAdminInviteAuditAction("FAILED"), "TENANT_ADMIN_INVITE_FAILED");
  assert.equal(firstAdminInviteAuditAction("INVITED"), "TENANT_ADMIN_INVITE_RESENT");
});
