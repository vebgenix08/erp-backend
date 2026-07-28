import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryTemplateRepository } from "../templates.repository";
import { createTemplateUseCase, updateTemplateUseCase } from "../use-cases";
import { createTemplateContext } from "./fixtures";

test("update template bumps version and keeps tenant isolation", async () => {
  const repository = new InMemoryTemplateRepository();
  const created = await createTemplateUseCase(
    {
      code: "INVOICE_TEMPLATE",
      name: "Invoice",
      templateType: "PRINT",
    },
    createTemplateContext(),
    { repository },
  );

  const updated = await updateTemplateUseCase(created.id, { name: "Invoice v2" }, createTemplateContext(), { repository });
  assert.equal(updated?.name, "Invoice v2");
  assert.equal(updated?.version, 2);
  assert.equal(updated?.status, "DRAFT");
});
