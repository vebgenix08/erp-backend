import test from "node:test";
import assert from "node:assert/strict";
import { DashboardRepository } from "../dashboard.repository";

test("dashboard summary aggregates platform counts", async () => {
  const repository = new DashboardRepository({
    tenants: Promise.resolve({
      list: async () => [{ status: "ACTIVE" }, { status: "SUSPENDED" }] as any,
    } as any),
    featureFlags: Promise.resolve({
      list: async () => [{ isEnabled: true }, { isEnabled: false }] as any,
    } as any),
    auditLogs: Promise.resolve({
      list: async () => [{}, {}, {}] as any,
    } as any),
    bootstraps: Promise.resolve({
      list: async () => [{}, {}] as any,
    } as any),
  });

  const result = await repository.getSummary();
  assert.equal(result.tenantCount, 2);
  assert.equal(result.activeTenantCount, 1);
  assert.equal(result.suspendedTenantCount, 1);
  assert.equal(result.bootstrapCount, 2);
  assert.equal(result.activeFeatureFlagCount, 1);
  assert.equal(result.auditLogCount, 3);
});
