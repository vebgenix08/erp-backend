import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryTemplateRepository } from "../templates.repository";
import { createTemplateUseCase, publishTemplateUseCase } from "../use-cases";
import { createTemplateContext } from "./fixtures";

test("publish template marks it published when required system keys are present", async () => {
  const repository = new InMemoryTemplateRepository();
  const created = await createTemplateUseCase(
    {
      code: "ADMISSION_FORM",
      name: "Admission form",
      templateType: "FORM",
      fields: [
        { key: "studentName", label: "Student name", type: "text", order: 1, required: true, visible: true },
        { key: "parentName", label: "Parent name", type: "text", order: 2, required: true, visible: true },
      ],
      requiredSystemKeys: ["studentName", "parentName"],
    },
    createTemplateContext(),
    { repository },
  );

  const published = await publishTemplateUseCase(created.id, createTemplateContext(), { repository });
  assert.equal(published?.status, "PUBLISHED");
  assert.equal(published?.publishedVersion, 1);
});

test("publishing a layout archives the previously published template for that layout", async () => {
  const repository = new InMemoryTemplateRepository();
  const context = createTemplateContext();
  const tenantId = context.tenantContext.tenantId;
  if (!tenantId) throw new Error("fixture tenantId is required");
  const first = await createTemplateUseCase(
    {
      code: "STAFF_ONBOARDING_V1",
      name: "Staff onboarding",
      templateType: "FORM",
      layout: "STAFF_ONBOARDING",
      fields: [{ key: "fullName", label: "Full name", type: "text", order: 1, required: true, visible: true }],
      requiredSystemKeys: ["fullName"],
    },
    context,
    { repository },
  );
  const second = await createTemplateUseCase(
    {
      code: "STAFF_ONBOARDING_V2",
      name: "Staff onboarding revised",
      templateType: "FORM",
      layout: "STAFF_ONBOARDING",
      fields: [{ key: "fullName", label: "Full name", type: "text", order: 1, required: true, visible: true }],
      requiredSystemKeys: ["fullName"],
    },
    context,
    { repository },
  );

  await publishTemplateUseCase(first.id, context, { repository });
  await publishTemplateUseCase(second.id, context, { repository });

  assert.equal((await repository.getById(tenantId, first.id))?.status, "ARCHIVED");
  assert.equal((await repository.getById(tenantId, second.id))?.status, "PUBLISHED");
});
