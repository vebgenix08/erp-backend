import test from "node:test";
import assert from "node:assert/strict";
import type { RequestContext } from "@school-erp/api";
import { getFinanceDashboard } from "../finance-dashboard.service";

const context: RequestContext = {
  requestId: "request",
  method: "POST",
  path: "graphql",
  headers: {},
  query: {},
  body: {},
  params: {},
  tenantContext: {
    tenantId: "tenant_one",
    source: "jwt-claims",
    resolvedAt: new Date(),
  },
  authContext: {
    source: "jwt-claims",
    authenticatedAt: new Date(),
    user: {
      id: "admin",
      permissions: ["finance.dashboard.read"],
      source: "jwt-claims",
    },
  },
};
test("dashboard reports net collection after refunds and voids", async () => {
  const at = new Date("2026-07-20T10:00:00.000Z");
  const result = await getFinanceDashboard(
    { campusId: "campus_1", academicYearId: "year_1" },
    context,
    {
      reporting: {
        summarize: async (_tenantId, scope) => {
          assert.equal(scope.today, at.toISOString().slice(0, 10));
          return {
            totalAssignedMinor: 100_000,
            grossCollectedMinor: 100_000,
            reversedMinor: 40_000,
            collectedMinor: 60_000,
            outstandingMinor: 40_000,
            collectedTodayMinor: 60_000,
            openOrders: 1,
            paidOrders: 0,
            paymentCount: 1,
            adjustmentCount: 1,
          };
        },
      },
      now: () => new Date("2026-07-20T12:00:00.000Z"),
    },
  );
  assert.equal(result.collectedMinor, 60_000);
  assert.equal(result.collectedTodayMinor, 60_000);
  assert.equal(result.outstandingMinor, 40_000);
});
