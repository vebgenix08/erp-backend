import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryTemplateRepository } from "../templates.repository";
import { createTemplateUseCase } from "../use-cases";
import { createTemplateContext } from "./fixtures";

test("create template stores a draft template", async () => {
  const repository = new InMemoryTemplateRepository();
  const result = await createTemplateUseCase(
    {
      code: "TEACHING_STAFF_ONBOARDING_FORM",
      name: "Teaching staff onboarding",
      templateType: "FORM",
      sections: [{ key: "identity", label: "Employee identity", order: 1 }],
      fields: [
        { key: "fullName", label: "Full name", type: "text", order: 1, required: true, visible: true, section: "identity" },
      ],
      requiredSystemKeys: ["fullName"],
    },
    createTemplateContext(),
    { repository },
  );

  assert.equal(result.code, "teaching_staff_onboarding_form");
  assert.equal(result.status, "DRAFT");
  assert.equal(result.version, 1);
  assert.equal(JSON.stringify(result.sections), JSON.stringify([{ key: "identity", label: "Employee identity", order: 1 }]));
});
