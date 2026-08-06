import assert from "node:assert/strict";
import test from "node:test";
import type { RequestContext } from "@school-erp/api";
import { createSubjectCatalogue, deactivateSubjectCatalogue, listSubjectCatalogue, updateSubjectCatalogue } from "../subject-catalogue.service";
import { InMemorySubjectCatalogueRepository } from "../subject-catalogue.repository";

const context = (tenantId = "tenant_one"): RequestContext => ({
  requestId: "request_1", method: "POST", path: "graphql:subjectCatalogue", headers: {}, query: {}, params: {}, body: {},
  tenantContext: { tenantId, source: "jwt-claims", resolvedAt: new Date() },
  authContext: { source: "jwt-claims", authenticatedAt: new Date(), user: { id: "admin_1", permissions: ["academics.subject-catalogue.read", "academics.subject-catalogue.create", "academics.subject-catalogue.update", "academics.subject-catalogue.deactivate"], source: "jwt-claims" } },
});

test("subject catalogue is reusable and tenant isolated", async () => {
  const repository = new InMemorySubjectCatalogueRepository();
  const mathematics = await createSubjectCatalogue({ name: "Mathematics", shortName: "Maths", subjectDomain: "Science" }, context(), { repository });
  await createSubjectCatalogue({ name: "Kannada", subjectDomain: "Language" }, context("tenant_two"), { repository });
  assert.equal(mathematics.status, "ACTIVE");
  assert.equal(mathematics.version, 1);
  assert.equal((await listSubjectCatalogue(context(), {}, { repository })).length, 1);
});

test("subject catalogue uses optimistic versioning and recorded deactivation", async () => {
  const repository = new InMemorySubjectCatalogueRepository();
  const created = await createSubjectCatalogue({ name: "Science" }, context(), { repository });
  const updated = await updateSubjectCatalogue(created.id, { expectedVersion: 1, shortName: "Sci" }, context(), { repository });
  assert.equal(updated.version, 2);
  await assert.rejects(() => updateSubjectCatalogue(created.id, { expectedVersion: 1, name: "General Science" }, context(), { repository }), /changed by another request/);
  const inactive = await deactivateSubjectCatalogue(created.id, "Replaced by separate science disciplines", context(), { repository });
  assert.equal(inactive.status, "INACTIVE");
  assert.equal(inactive.deactivationReason, "Replaced by separate science disciplines");
});
