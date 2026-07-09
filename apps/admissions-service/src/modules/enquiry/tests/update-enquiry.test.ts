import test from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "@school-erp/errors";
import { InMemoryEnquiryRepository } from "../enquiry.repository";
import { createEnquiryUseCase, updateEnquiryUseCase } from "../use-cases";
import { createEnquiryInput, createEnquiryServiceContext } from "./fixtures";

test("update enquiry modifies fields only within the tenant", async () => {
  const repository = new InMemoryEnquiryRepository();
  const created = await createEnquiryUseCase(createEnquiryInput({ studentName: "Old Name" }), createEnquiryServiceContext({ tenantId: "tenant_a" }), { repository });

  const updated = await updateEnquiryUseCase(
    String(created?.id ?? ""),
    { studentName: "New Name", status: "CONTACTED" },
    createEnquiryServiceContext({ tenantId: "tenant_a" }),
    { repository },
  );

  assert.equal(updated?.studentName, "New Name");
  assert.equal(updated?.status, "CONTACTED");
});

test("update enquiry rejects closed status", async () => {
  const repository = new InMemoryEnquiryRepository();
  const created = await createEnquiryUseCase(createEnquiryInput(), createEnquiryServiceContext(), { repository });

  await assert.rejects(
    () => updateEnquiryUseCase(String(created?.id ?? ""), { status: "CLOSED" }, createEnquiryServiceContext(), { repository }),
    ValidationError,
  );
});
