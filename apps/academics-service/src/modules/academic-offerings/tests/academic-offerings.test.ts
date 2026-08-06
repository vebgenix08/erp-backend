import assert from "node:assert/strict";
import test from "node:test";
import type { RequestContext } from "@school-erp/api";
import { InMemoryClassRepository } from "../../classes/classes.repository";
import { InMemoryCurriculumRepository } from "../../curricula/curricula.repository";
import { InMemoryProgramRepository } from "../../programs/programs.repository";
import { InMemorySectionRepository } from "../../sections/sections.repository";
import { academicOfferingPermissions } from "../academic-offerings.permissions";
import { InMemoryAcademicOfferingRepository } from "../academic-offerings.repository";
import { createAcademicOffering } from "../academic-offerings.service";

const context: RequestContext = {
  requestId: "request_offering", method: "POST", path: "/academic-offerings", headers: {}, query: {}, params: {}, body: {},
  tenantContext: { tenantId: "tenant_one", source: "request", resolvedAt: new Date() },
  authContext: { source: "request", authenticatedAt: new Date(), user: { id: "admin", permissions: Object.values(academicOfferingPermissions), source: "request" } },
};
test("academic offering enforces the full local hierarchy", async () => {
  const curricula = new InMemoryCurriculumRepository();
  const programs = new InMemoryProgramRepository();
  const classes = new InMemoryClassRepository();
  const sections = new InMemorySectionRepository();
  const repository = new InMemoryAcademicOfferingRepository();
  const curriculum = await curricula.create("tenant_one", { name: "CBSE Curriculum", type: "CBSE" });
  const program = await programs.create("tenant_one", { campusId: "campus_main", academicUnitId: "unit_school", code: "PRI", name: "Primary School" });
  const academicClass = await classes.create("tenant_one", { campusId: "campus_main", programId: program.id, code: "C01", name: "Class 1" });
  const section = await sections.create("tenant_one", { campusId: "campus_main", programId: program.id, classId: academicClass.id, code: "A", name: "Section A" });
  const offering = await createAcademicOffering({
    campusId: "campus_main", academicYearId: "year_2026", curriculumId: curriculum.id,
    programId: program.id, classId: academicClass.id, sectionId: section.id, capacity: 40,
  }, context, { repository, curricula, programs, classes, sections });
  assert.equal(offering.sectionId, section.id);
  assert.equal(offering.capacity, 40);
});
