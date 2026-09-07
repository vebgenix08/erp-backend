import assert from "node:assert/strict";
import test from "node:test";
import type { InternalServiceInvoker } from "@school-erp/service-client";
import { InternalPlanningReferenceReader } from "../planning-reference.repository";

test("faculty references use bounded tenant-scoped Identity batches", async () => {
  const requests: Array<{ tenantId: string; employeeIds: string[] }> = [];
  const invoker: InternalServiceInvoker = {
    async invoke<T, R>(_name: string, request: { operation: string; payload: T }): Promise<R> {
      assert.equal(request.operation, "GET_EMPLOYEES");
      const payload = request.payload as { tenantId: string; employeeIds: string[] };
      requests.push(payload);
      return payload.employeeIds.map((id) => ({ id, tenantId: payload.tenantId })) as R;
    },
  };
  const reader = new InternalPlanningReferenceReader("identity", "settings", invoker);
  const ids = Array.from({ length: 135 }, (_, index) => `employee-${index}`);
  const employees = await reader.getEmployees("tenant-one", [...ids, ids[0]!]);
  assert.equal(employees.length, 135);
  assert.deepEqual(
    requests.map((item) => item.employeeIds.length),
    [100, 35],
  );
  assert.ok(requests.every((item) => item.tenantId === "tenant-one"));
  assert.deepEqual(await reader.getEmployees("tenant-one", []), []);
  assert.equal(requests.length, 2);
});
