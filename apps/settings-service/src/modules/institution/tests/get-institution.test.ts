import test from "node:test";
import assert from "node:assert/strict";
import { createMockRequestContext } from "@school-erp/test-utils";
import { createInstitutionFixture } from "./fixtures";
import { InMemoryInstitutionRepository } from "../institution.repository";
import { updateInstitutionUseCase, getInstitutionUseCase } from "../use-cases";

test("get institution returns the stored profile", async () => {
  const repository = new InMemoryInstitutionRepository();
  const context = createMockRequestContext({
    tenantContext: { tenantId: "tenant-1" } as any,
    authContext: {
      user: { id: "user-1", permissions: ["settings.institution.read", "settings.institution.update"] },
      source: "request",
      authenticatedAt: new Date(),
    } as any,
  });
  await updateInstitutionUseCase(createInstitutionFixture(), context as any, { repository });
  const result = await getInstitutionUseCase(context as any, { repository });
  assert.equal(result?.name, "Sample Institution");
});
