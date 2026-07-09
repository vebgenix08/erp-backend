import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryEnquiryRepository } from "../enquiry.repository";
import { createEnquiryUseCase, getEnquiryUseCase } from "../use-cases";
import { createEnquiryInput, createEnquiryServiceContext } from "./fixtures";

test("get enquiry returns only the enquiry within the tenant", async () => {
  const repository = new InMemoryEnquiryRepository();
  const created = await createEnquiryUseCase(createEnquiryInput({ studentName: "Alice" }), createEnquiryServiceContext({ tenantId: "tenant_a" }), { repository });
  await createEnquiryUseCase(createEnquiryInput({ studentName: "Bob" }), createEnquiryServiceContext({ tenantId: "tenant_b" }), { repository });

  const found = await getEnquiryUseCase(String(created?.id ?? ""), createEnquiryServiceContext({ tenantId: "tenant_a" }), { repository });
  const missing = await getEnquiryUseCase(String(created?.id ?? ""), createEnquiryServiceContext({ tenantId: "tenant_b" }), { repository });

  assert.equal(found?.studentName, "Alice");
  assert.equal(missing, null);
});
