import assert from "node:assert/strict";
import test from "node:test";
import type { RequestContext } from "@school-erp/api";
import { InMemoryFeeConfigurationRepository } from "../fee-configuration.repository";
import {
  createFeeHead,
  createFeeMapping,
  createFeeSchedule,
  createFeeStructure,
  listFeeConfiguration,
  updateFeeHead,
} from "../fee-configuration.service";

function context(tenantId = "tenant_one"): RequestContext {
  return {
    requestId: "request_1",
    method: "POST",
    path: "/finance",
    headers: {},
    query: {},
    body: {},
    params: {},
    tenantContext: { tenantId, source: "x-tenant-id", resolvedAt: new Date() },
    authContext: {
      source: "headers",
      authenticatedAt: new Date(),
      user: {
        id: "user_1",
        permissions: [
          "finance.fee-configuration.read",
          "finance.fee-configuration.create",
          "finance.fee-configuration.deactivate",
          "finance.fee-configuration.update",
        ],
        source: "headers",
      },
    },
  };
}

async function createConfiguration(
  repository: InMemoryFeeConfigurationRepository,
) {
  const deps = { repository };
  const ctx = context();
  const head = await createFeeHead(
    { name: "Tuition Fee", category: "TUITION" },
    ctx,
    deps,
  );
  const schedule = await createFeeSchedule(
    {
      campusId: "campus_1",
      academicYearId: "year_1",
      name: "Annual collection",
      pattern: "ANNUAL",
      collectionPolicy: "PARTIAL_ALLOWED",
    },
    ctx,
    deps,
  );
  const structure = await createFeeStructure(
    {
      campusId: "campus_1",
      academicYearId: "year_1",
      name: "Class 10 Fee",
      components: [{ feeHeadId: head.id, amountMinor: 125_000 }],
    },
    ctx,
    deps,
  );
  return { deps, ctx, head, schedule, structure };
}

test("creates a date-free fee configuration and keeps tenants isolated", async () => {
  const repository = new InMemoryFeeConfigurationRepository();
  const { deps, ctx, schedule, structure } =
    await createConfiguration(repository);
  await createFeeMapping(
    {
      campusId: "campus_1",
      academicYearId: "year_1",
      structureId: structure.id,
      scheduleId: schedule.id,
      target: { classId: "class_10" },
    },
    ctx,
    deps,
  );
  const snapshot = await listFeeConfiguration(
    { campusId: "campus_1", academicYearId: "year_1" },
    ctx,
    deps,
  );
  assert.equal(snapshot.schedules[0]?.pattern, "ANNUAL");
  assert.equal(snapshot.structures[0]?.totalAmountMinor, 125_000);
  assert.equal(
    snapshot.structures[0]?.components[0]?.allocationPriority,
    1,
  );
  assert.equal(snapshot.mappings.length, 1);
  const other = await listFeeConfiguration(
    { campusId: "campus_1", academicYearId: "year_1" },
    context("tenant_two"),
    deps,
  );
  assert.equal(other.feeHeads.length, 0);
});

test("supports the approved charging patterns", async () => {
  const repository = new InMemoryFeeConfigurationRepository();
  for (const pattern of ["ANNUAL", "ONE_TIME", "PERIODIC", "MANUAL"] as const) {
    const schedule = await createFeeSchedule(
      {
        campusId: "campus_1",
        academicYearId: "year_1",
        name: `${pattern} collection`,
        pattern,
        collectionPolicy: "PARTIAL_ALLOWED",
      },
      context(),
      { repository },
    );
    assert.equal(schedule.pattern, pattern);
  }
});

test("edits a fee head without changing its generated identity", async () => {
  const repository = new InMemoryFeeConfigurationRepository();
  const created = await createFeeHead(
    { name: "Exam Fee", category: "EXAM" },
    context(),
    { repository },
  );
  const updated = await updateFeeHead(
    created.id,
    {
      name: "Board Examination Fee",
      category: "EXAM",
      description: "External examination registration and processing",
      refundable: false,
    },
    context(),
    { repository },
  );
  assert.equal(updated.id, created.id);
  assert.equal(updated.code, created.code);
  assert.equal(updated.name, "Board Examination Fee");
  assert.equal(
    updated.description,
    "External examination registration and processing",
  );
});

test("rejects an unsupported charging pattern", async () => {
  await assert.rejects(
    () =>
      createFeeSchedule(
        {
          campusId: "campus_1",
          academicYearId: "year_1",
          name: "Invalid schedule",
          pattern: "UNSUPPORTED" as "ANNUAL",
          collectionPolicy: "PARTIAL_ALLOWED",
        },
        context(),
        { repository: new InMemoryFeeConfigurationRepository() },
      ),
    /pattern is invalid/,
  );
});

test("rejects duplicate active mappings", async () => {
  const repository = new InMemoryFeeConfigurationRepository();
  const { deps, ctx, schedule, structure } =
    await createConfiguration(repository);
  const input = {
    campusId: "campus_1",
    academicYearId: "year_1",
    structureId: structure.id,
    scheduleId: schedule.id,
    target: { classId: "class_1" },
  };
  await createFeeMapping(input, ctx, deps);
  await assert.rejects(
    () => createFeeMapping(input, ctx, deps),
    /already exists/,
  );
});
