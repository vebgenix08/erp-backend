import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryEnquiryRepository } from "../enquiry.repository";
import { closeEnquiryUseCase, createEnquiryUseCase } from "../use-cases";
import { createEnquiryInput, createEnquiryServiceContext } from "./fixtures";

test("close enquiry sets closed status and closedAt", async () => {
  const repository = new InMemoryEnquiryRepository();
  const created = await createEnquiryUseCase(createEnquiryInput(), createEnquiryServiceContext(), { repository });

  const closed = await closeEnquiryUseCase(String(created?.id ?? ""), createEnquiryServiceContext(), { repository });

  assert.equal(closed?.status, "CLOSED");
  assert.ok(closed?.closedAt);
});

test("close enquiry is tenant isolated", async () => {
  const repository = new InMemoryEnquiryRepository();
  const created = await createEnquiryUseCase(createEnquiryInput(), createEnquiryServiceContext({ tenantId: "tenant_a" }), { repository });

  const result = await closeEnquiryUseCase(String(created?.id ?? ""), createEnquiryServiceContext({ tenantId: "tenant_b" }), { repository });

  assert.equal(result, null);
});
