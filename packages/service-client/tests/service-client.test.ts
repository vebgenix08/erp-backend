import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";
import {
  hydrateConfiguredAuthorization,
  ServiceNumberingGateway,
  type InternalServiceInvoker,
} from "../src";

test("numbering gateway sends a typed internal command", async () => {
  const calls: unknown[] = [];
  const invoker: InternalServiceInvoker = {
    async invoke(_functionName, request) {
      calls.push(request);
      return "EMP/000001" as never;
    },
  };
  const gateway = new ServiceNumberingGateway("settings-numbering-dev", invoker);
  assert.equal(
    await gateway.issue({
      tenantId: "tenant_1",
      stream: "EMPLOYEE",
      idempotencyKey: "employee_1",
    }),
    "EMP/000001",
  );
  assert.deepEqual(calls, [
    {
      operation: "ISSUE_NUMBER",
      payload: {
        tenantId: "tenant_1",
        stream: "EMPLOYEE",
        idempotencyKey: "employee_1",
      },
    },
  ]);
});

test("numbering gateway sends one ordered batch command", async () => {
  const calls: unknown[] = [];
  const invoker: InternalServiceInvoker = {
    async invoke(_functionName, request) {
      calls.push(request);
      return ["01", "02"] as never;
    },
  };
  const gateway = new ServiceNumberingGateway("settings-numbering-dev", invoker);
  const contexts = ["enrollment_1", "enrollment_2"].map((idempotencyKey) => ({
    tenantId: "tenant_1",
    stream: "ROLL_NUMBER" as const,
    idempotencyKey,
    academicYearId: "year_1",
    sectionId: "section_1",
  }));

  assert.deepEqual(await gateway.issueBatch(contexts), ["01", "02"]);
  assert.deepEqual(calls, [
    {
      operation: "ISSUE_NUMBER_BATCH",
      payload: contexts,
    },
  ]);
});

test("authorization hydration replaces token permissions with Identity data", async () => {
  const previous = process.env.IDENTITY_FUNCTION_NAME;
  process.env.IDENTITY_FUNCTION_NAME = "identity-service-graphql-dev";
  const invoker: InternalServiceInvoker = {
    async invoke() {
      return {
        userId: "user-1",
        principalId: "principal-1",
        role: "TEACHER",
        roles: [{ id: "role-1", code: "TEACHER", name: "Teacher" }],
        permissions: ["academics.student.read"],
        scopes: [
          {
            assignmentId: "assignment-1",
            roleId: "role-1",
            roleCode: "TEACHER",
            scope: { scopeType: "CAMPUS", campusIds: ["campus-1"] },
          },
        ],
      } as never;
    },
  };
  const context = {
    requestId: "request-1",
    path: "graphql:test",
    method: "POST" as const,
    headers: {},
    query: {},
    body: {},
    params: {},
    tenantContext: { tenantId: "tenant-1", source: "jwt-claims" as const, resolvedAt: new Date() },
    authContext: {
      source: "jwt-claims" as const,
      authenticatedAt: new Date(),
      user: {
        id: "principal-1",
        role: "STALE_ROLE",
        permissions: ["stale.permission.read"] as never,
        source: "jwt-claims" as const,
      },
    },
  };

  await hydrateConfiguredAuthorization(context, invoker);

  assert.equal(context.authContext.user.role, "TEACHER");
  assert.deepEqual(context.authContext.user.permissions, ["academics.student.read"]);
  if (previous === undefined) delete process.env.IDENTITY_FUNCTION_NAME;
  else process.env.IDENTITY_FUNCTION_NAME = previous;
});
