import assert from "node:assert/strict";
import test from "node:test";
import type { RequestContext } from "@school-erp/api";
import { createCurriculumSubject } from "../curriculum-subjects.service";
import { InMemoryCurriculumSubjectRepository } from "../curriculum-subjects.repository";
import { InMemorySubjectCatalogueRepository } from "../../subject-catalogue/subject-catalogue.repository";

const ctx = (tenantId = "tenant_one"): RequestContext => ({
  requestId: "request", path: "graphql", method: "POST", headers: {}, query: {}, params: {}, body: {},
  tenantContext: { tenantId, source: "jwt-claims", resolvedAt: new Date() },
  authContext: { source: "jwt-claims", authenticatedAt: new Date(), user: { id: "admin", source: "jwt-claims", permissions: ["academics.curriculum-subject.create"] } },
});
test("curriculum subject requires an active tenant-owned catalogue record", async () => {
  const repository = new InMemoryCurriculumSubjectRepository(), catalogueRepository = new InMemorySubjectCatalogueRepository();
  const catalogue = await catalogueRepository.create("tenant_one", "admin", { name: "Mathematics" });
  const record = await createCurriculumSubject({
    academicUnitId: "unit_school", curriculumId: "curriculum_cbse", programId: "program_school",
    academicLevelId: "level_10", subjectCatalogueId: catalogue.id, subjectCategory: "CORE",
  }, ctx(), { repository, catalogueRepository });
  assert.equal(record.isMandatory, true);
  await assert.rejects(() => createCurriculumSubject({
    academicUnitId: "unit_school", curriculumId: "curriculum_state", programId: "program_school",
    academicLevelId: "level_10", subjectCatalogueId: catalogue.id, subjectCategory: "CORE",
  }, ctx("tenant_two"), { repository, catalogueRepository }), /not found/);
});
