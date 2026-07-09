import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryEnquiryRepository } from "../enquiry.repository";
import { createEnquiryUseCase } from "../use-cases";
import { createEnquiryInput, createEnquiryServiceContext } from "./fixtures";

test("create enquiry stores a tenant-scoped enquiry with a generated enquiry number", async () => {
  const repository = new InMemoryEnquiryRepository();
  const context = createEnquiryServiceContext();
  const result = await createEnquiryUseCase(createEnquiryInput(), context, { repository });

  assert.equal(result?.tenantId, "tenant_test_1");
  assert.equal(result?.status, "NEW");
  assert.equal(result?.createdBy, "user_test_1");
  assert.match(result?.enquiryNumber ?? "", /^ENQ-\d{4}$/);
});

test("create enquiry generates numbers per tenant", async () => {
  const repository = new InMemoryEnquiryRepository();
  const first = await createEnquiryUseCase(createEnquiryInput({ studentName: "One" }), createEnquiryServiceContext({ tenantId: "tenant_a" }), { repository });
  const second = await createEnquiryUseCase(createEnquiryInput({ studentName: "Two" }), createEnquiryServiceContext({ tenantId: "tenant_a" }), { repository });
  const otherTenant = await createEnquiryUseCase(createEnquiryInput({ studentName: "Three" }), createEnquiryServiceContext({ tenantId: "tenant_b" }), { repository });

  assert.equal(first?.enquiryNumber, "ENQ-0001");
  assert.equal(second?.enquiryNumber, "ENQ-0002");
  assert.equal(otherTenant?.enquiryNumber, "ENQ-0001");
});

test("create enquiry ignores tenantId in the request body", async () => {
  const repository = new InMemoryEnquiryRepository();
  const result = await createEnquiryUseCase(
    createEnquiryInput({ tenantId: "body_tenant_should_be_ignored" }),
    createEnquiryServiceContext({ tenantId: "tenant_context_wins" }),
    { repository },
  );

  assert.equal(result?.tenantId, "tenant_context_wins");
});
