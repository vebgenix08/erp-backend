import test from "node:test";
import assert from "node:assert/strict";
import type { RequestContext } from "@school-erp/api";
import { InMemoryTenantEntitlementRepository } from "../entitlements.repository";
import {
  listTenantEntitlements,
  setTenantEntitlement,
} from "../entitlements.service";

const context: RequestContext = {
  requestId: "req",
  path: "graphql",
  method: "POST",
  headers: {},
  query: {},
  params: {},
  body: undefined,
  authContext: {
    source: "request",
    authenticatedAt: new Date(),
    user: {
      id: "admin",
      role: "SUPER_ADMIN",
      permissions: [
        "platform.entitlements.read",
        "platform.entitlements.manage",
      ],
      source: "request",
    },
  },
};
test("tenant entitlements remain separate per tenant", async () => {
  const repository = new InMemoryTenantEntitlementRepository();
  for (const featureCode of ["ACADEMICS", "STUDENT_MANAGEMENT"] as const) {
    await setTenantEntitlement({ tenantId: "tenant-a", featureCode, status: "ENABLED" }, context, { repository });
  }
  await setTenantEntitlement(
    {
      tenantId: "tenant-a",
      featureCode: "FINANCE",
      status: "ENABLED",
      limits: { students: 1000 },
    },
    context,
    { repository },
  );
  await setTenantEntitlement(
    { tenantId: "tenant-b", featureCode: "FINANCE", status: "DISABLED" },
    context,
    { repository },
  );
  const records = await listTenantEntitlements("tenant-a", context, {
    repository,
  });
  assert.equal(records.length, 3);
  const finance = records.find((record) => record.featureCode === "FINANCE");
  assert.equal(finance?.status, "ENABLED");
  assert.equal(finance?.limits?.students, 1000);
});

test("tenant capability dependencies are enforced", async () => {
  const repository = new InMemoryTenantEntitlementRepository();
  await assert.rejects(
    async () => setTenantEntitlement({ tenantId: "tenant-a", featureCode: "ADMISSIONS", status: "ENABLED" }, context, { repository }),
    /enable required capabilities first: ACADEMICS, STUDENT_MANAGEMENT/,
  );
});

test("arbitrary feature codes cannot become tenant capabilities", async () => {
  const repository = new InMemoryTenantEntitlementRepository();
  await assert.rejects(
    async () => setTenantEntitlement({ tenantId: "tenant-a", featureCode: "ONBOARDING_STEP_4", status: "ENABLED" }, context, { repository }),
    /not an assignable tenant capability/,
  );
});

test("a dependency cannot be disabled while a dependent capability is enabled", async () => {
  const repository = new InMemoryTenantEntitlementRepository();
  await setTenantEntitlement({ tenantId: "tenant-a", featureCode: "ACADEMICS", status: "ENABLED" }, context, { repository });
  await setTenantEntitlement({ tenantId: "tenant-a", featureCode: "STUDENT_MANAGEMENT", status: "ENABLED" }, context, { repository });
  await assert.rejects(
    async () => setTenantEntitlement({ tenantId: "tenant-a", featureCode: "ACADEMICS", status: "DISABLED" }, context, { repository }),
    /disable dependent capabilities first: STUDENT_MANAGEMENT/,
  );
});
