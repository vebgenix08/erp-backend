import test from "node:test";
import assert from "node:assert/strict";
import { createSessionContext } from "./fixtures";
import { getSessionUseCase } from "../use-cases";

test("get session returns auth and tenant snapshots", async () => {
  const activations: Array<{ tenantId: string; email: string }> = [];
  const result = await getSessionUseCase(createSessionContext(), {
    employeeLoginActivator: async (tenantId, email) => {
      activations.push({ tenantId, email });
    },
    employeeResolver: async () => ({
      fullName: "Ananya Rao",
      profilePhotoFileId: "file-profile-1",
    }),
  });
  assert.equal(result.user.id, "user_test_1");
  assert.equal(result.tenant?.tenantId, "tenant_test_1");
  assert.equal(result.user.fullName, "Ananya Rao");
  assert.equal(result.user.profilePhotoFileId, "file-profile-1");
  assert.deepEqual(activations, [{ tenantId: "tenant_test_1", email: "user@example.com" }]);
});

test("get session bootstraps a tenant administrator before resolving authorization", async () => {
  const context = createSessionContext();
  context.authContext!.user!.role = "TENANT_ADMIN";
  const bootstrapped: string[] = [];

  await getSessionUseCase(context, {
    employeeLoginActivator: async () => undefined,
    employeeResolver: async () => null,
    tenantAdminBootstrapper: async (requestContext) => {
      bootstrapped.push(requestContext.authContext!.user!.id);
    },
  });

  assert.deepEqual(bootstrapped, ["user_test_1"]);
});
