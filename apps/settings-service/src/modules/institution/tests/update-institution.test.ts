import test from "node:test";
import assert from "node:assert/strict";
import { createMockRequestContext } from "@school-erp/test-utils";
import { InMemoryInstitutionRepository } from "../institution.repository";
import { updateInstitutionUseCase } from "../use-cases";
import { createInstitutionFixture } from "./fixtures";

test("update institution creates and updates the profile", async () => {
  const repository = new InMemoryInstitutionRepository();
  const context = createMockRequestContext({
    tenantContext: { tenantId: "tenant-1" } as any,
    authContext: {
      user: { id: "user-1", permissions: ["settings.institution.update"] },
      source: "request",
      authenticatedAt: new Date(),
    } as any,
  });

  const created = await updateInstitutionUseCase(createInstitutionFixture(), context as any, { repository });
  assert.equal(created.name, "Sample Institution");

  const updated = await updateInstitutionUseCase({ name: "Updated Institution" }, context as any, { repository });
  assert.equal(updated.name, "Updated Institution");
});
