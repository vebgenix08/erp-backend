import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryTemplateRepository } from "../templates.repository";
import { createTemplateUseCase, listTemplatesUseCase } from "../use-cases";
import { createTemplateContext } from "./fixtures";

test("list templates filters by type", async () => {
  const repository = new InMemoryTemplateRepository();
  await createTemplateUseCase({ code: "A", name: "A", templateType: "FORM" }, createTemplateContext(), { repository });
  await createTemplateUseCase({ code: "B", name: "B", templateType: "EMAIL" }, createTemplateContext(), { repository });

  const records = await listTemplatesUseCase(createTemplateContext(), { repository }, { templateType: "FORM" });
  assert.equal(records.length, 1);
  assert.equal(records[0]?.code, "a");
});
