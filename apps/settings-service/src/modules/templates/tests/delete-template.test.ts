import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryTemplateRepository } from "../templates.repository";
import { archiveTemplateUseCase, createTemplateUseCase, listTemplatesUseCase } from "../use-cases";
import { createTemplateContext } from "./fixtures";

test("archive template marks it unavailable for live editing", async () => {
  const repository = new InMemoryTemplateRepository();
  const created = await createTemplateUseCase({ code: "A", name: "A", templateType: "FORM" }, createTemplateContext(), { repository });
  const deleted = await archiveTemplateUseCase(created.id, createTemplateContext(), { repository });
  const records = await listTemplatesUseCase(createTemplateContext(), { repository });
  assert.equal(deleted, true);
  assert.equal(records[0]?.status, "ARCHIVED");
});
