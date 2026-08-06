import assert from "node:assert/strict";
import test from "node:test";
import type { RequestContext } from "@school-erp/api";
import { InMemoryCurriculumRepository } from "../curricula.repository";
import { createCurriculum, listCurricula, updateCurriculum } from "../curricula.service";
import { curriculumPermissions } from "../curricula.permissions";

const context = (tenantId: string): RequestContext => ({
  requestId: "request_curriculum",
  method: "POST",
  path: "/curricula",
  headers: {},
  query: {},
  params: {},
  body: {},
  tenantContext: { tenantId, source: "request", resolvedAt: new Date() },
  authContext: {
    source: "request",
    authenticatedAt: new Date(),
    user: { id: "user_admin", permissions: Object.values(curriculumPermissions), source: "request" },
  },
});

test("curricula are tenant isolated and codes are backend generated", async () => {
  const repository = new InMemoryCurriculumRepository();
  const created = await createCurriculum({ name: "Central Board of Secondary Education", type: "CBSE" }, context("tenant_one"), { repository });
  assert.match(created.code, /^CUR-/);
  assert.equal((await listCurricula(context("tenant_one"), {}, { repository })).length, 1);
  assert.equal((await listCurricula(context("tenant_two"), {}, { repository })).length, 0);
});

test("curriculum can be updated without exposing its code", async () => {
  const repository = new InMemoryCurriculumRepository();
  const created = await createCurriculum({ name: "State Curriculum", type: "STATE_BOARD" }, context("tenant_one"), { repository });
  const updated = await updateCurriculum(created.id, { authorityName: "Department of School Education" }, context("tenant_one"), { repository });
  assert.equal(updated?.authorityName, "Department of School Education");
  assert.equal(updated?.code, created.code);
});
