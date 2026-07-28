import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryAuditLogRepository } from "../audit-logs.repository";
import { appendAuditLog, listAuditLogs } from "../audit-logs.service";
import { createAuditLogContext } from "./fixtures";

test("audit log append is append-only and listable", async () => {
  const repository = new InMemoryAuditLogRepository();
  await appendAuditLog({ action: "TENANT_CREATED", entityType: "TENANT", entityId: "tenant_1" }, { repository });
  await appendAuditLog({ action: "TENANT_UPDATED", entityType: "TENANT", entityId: "tenant_1" }, { repository });

  const result = await listAuditLogs(createAuditLogContext(), { repository });
  assert.equal(result.length, 2);
  assert.equal(result[0]?.action, "TENANT_UPDATED");
  assert.equal(result[1]?.action, "TENANT_CREATED");
});

test("audit list resolves tenant names without changing stored evidence", async () => {
  const repository = new InMemoryAuditLogRepository();
  await appendAuditLog(
    { tenantId: "tenant_1", action: "TENANT_DELETION_CONFIRMED", entityType: "TENANT", entityId: "tenant_1" },
    { repository },
  );

  const result = await listAuditLogs(createAuditLogContext(), {
    repository,
    tenants: {
      list: async () => [{ id: "tenant_1", name: "North Campus School" }],
    } as never,
  });

  assert.equal(result[0]?.tenantName, "North Campus School");
  assert.equal(result[0]?.tenantId, "tenant_1");
});
