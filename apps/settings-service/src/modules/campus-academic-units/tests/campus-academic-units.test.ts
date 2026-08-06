import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryCampusAcademicUnitRepository } from "../campus-academic-units.repository";

test("academic units are separate tenant and campus scoped records", async () => {
  const repository = new InMemoryCampusAcademicUnitRepository();
  const school = await repository.create("tenant_one", "campus_main", {
    name: "CBSE School",
    type: "SCHOOL",
    curriculumOrAffiliationId: "CBSE",
  });
  await repository.create("tenant_one", "campus_main", {
    name: "PU College",
    type: "PU",
    curriculumOrAffiliationId: "KARNATAKA_PUE",
  });
  assert.equal(school.code.startsWith("UNIT-"), true);
  assert.equal((await repository.list("tenant_one", { campusId: "campus_main" })).length, 2);
  assert.equal((await repository.list("tenant_two", { campusId: "campus_main" })).length, 0);
});

test("one campus can have two school units with different curricula", async () => {
  const repository = new InMemoryCampusAcademicUnitRepository();
  await repository.create("tenant_one", "campus_main", { name: "CBSE School", type: "SCHOOL", curriculumOrAffiliationId: "CBSE" });
  await repository.create("tenant_one", "campus_main", { name: "State School", type: "SCHOOL", curriculumOrAffiliationId: "STATE_BOARD" });
  assert.equal((await repository.list("tenant_one", { campusId: "campus_main", type: "SCHOOL" })).length, 2);
  await assert.rejects(
    () => repository.create("tenant_one", "campus_main", { name: "Duplicate CBSE Unit", type: "SCHOOL", curriculumOrAffiliationId: "CBSE" }),
    /already exists/,
  );
});
