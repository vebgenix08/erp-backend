import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryTemplateRepository } from "../templates.repository";
import { createTemplateUseCase, getTemplateUseCase } from "../use-cases";
import { createTemplateContext } from "./fixtures";

test("get template returns the stored template", async () => {
  const repository = new InMemoryTemplateRepository();
  const created = await createTemplateUseCase({ code: "A", name: "A", templateType: "FORM" }, createTemplateContext(), { repository });
  const fetched = await getTemplateUseCase(created.id, createTemplateContext(), { repository });
  assert.equal(fetched?.id, created.id);
});
