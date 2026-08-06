import assert from "node:assert/strict";
import test from "node:test";
import type { RequestContext } from "@school-erp/api";
import { createCampusSetup } from "../campus-setup.service";
import { InMemoryCampusSetupRepository } from "../campus-setup.repository";

const context: RequestContext = {
  requestId: "request_setup", path: "graphql:createCampusSetup", method: "POST", headers: {}, query: {}, params: {}, body: {},
  tenantContext: { tenantId: "tenant_one", source: "request", resolvedAt: new Date() },
  authContext: { source: "request", authenticatedAt: new Date(), user: { id: "admin", permissions: ["settings.campuses.create"], source: "request" } },
};
test("campus setup atomically creates a campus and all selected academic units", async () => {
  const repository = new InMemoryCampusSetupRepository();
  const result = await createCampusSetup(context, {
    name: "Vidyanagara Campus",
    academicUnits: [
      { name: "CBSE School", type: "SCHOOL", curriculumOrAffiliationId: "CBSE" },
      { name: "PU College", type: "PU", curriculumOrAffiliationId: "KARNATAKA_PUE" },
      { name: "Degree College", type: "DEGREE", curriculumOrAffiliationId: "BENGALURU_UNIVERSITY" },
    ],
  }, { repository });
  assert.equal(result.academicUnits.length, 3);
  assert.equal(repository.campuses.size, 1);
  assert.equal(repository.academicUnits.size, 3);
});
test("campus setup rejects duplicate unit combinations before writing", async () => {
  const repository = new InMemoryCampusSetupRepository();
  await assert.rejects(() => createCampusSetup(context, {
    name: "Invalid Campus",
    academicUnits: [
      { name: "CBSE School", type: "SCHOOL", curriculumOrAffiliationId: "CBSE" },
      { name: "Second CBSE School", type: "SCHOOL", curriculumOrAffiliationId: "CBSE" },
    ],
  }, { repository }), /duplicate academic units/);
  assert.equal(repository.campuses.size, 0);
});
test("one campus can own independent CBSE, State Board and ICSE school units", async () => {
  const repository = new InMemoryCampusSetupRepository();
  const result = await createCampusSetup(context, {
    name: "Multi Board Campus",
    academicUnits: [
      { name: "CBSE Wing", type: "SCHOOL", curriculumOrAffiliationId: "CBSE" },
      { name: "State Board Wing", type: "SCHOOL", curriculumOrAffiliationId: "STATE_BOARD" },
      { name: "ICSE Wing", type: "SCHOOL", curriculumOrAffiliationId: "ICSE" },
    ],
  }, { repository });
  assert.equal(
    result.academicUnits.map((unit) => unit.curriculumOrAffiliationId).sort().join(","),
    "CBSE,ICSE,STATE_BOARD",
  );
  assert.equal(new Set(result.academicUnits.map((unit) => unit.id)).size, 3);
});
