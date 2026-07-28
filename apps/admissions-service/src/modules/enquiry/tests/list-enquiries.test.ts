import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryEnquiryRepository } from "../enquiry.repository";
import { closeEnquiryUseCase, createEnquiryUseCase, listEnquiriesUseCase, updateEnquiryUseCase } from "../use-cases";
import { createEnquiryInput, createEnquiryServiceContext } from "./fixtures";

test("list enquiries returns only tenant enquiries in creation order", async () => {
  const repository = new InMemoryEnquiryRepository();
  await createEnquiryUseCase(createEnquiryInput({ studentName: "Alpha" }), createEnquiryServiceContext({ tenantId: "tenant_a" }), { repository });
  await createEnquiryUseCase(createEnquiryInput({ studentName: "Beta" }), createEnquiryServiceContext({ tenantId: "tenant_a" }), { repository });
  await createEnquiryUseCase(createEnquiryInput({ studentName: "Gamma" }), createEnquiryServiceContext({ tenantId: "tenant_b" }), { repository });

  const list = await listEnquiriesUseCase(createEnquiryServiceContext({ tenantId: "tenant_a" }), { repository });

  assert.equal(list.length, 2);
  assert.equal(list[0]?.studentName, "Alpha");
  assert.equal(list[1]?.studentName, "Beta");
});

test("list enquiries supports status, source, and search filters", async () => {
  const repository = new InMemoryEnquiryRepository();
  const created = await createEnquiryUseCase(
    createEnquiryInput({ studentName: "Filter Match", source: "Walk-In" }),
    createEnquiryServiceContext({ tenantId: "tenant_a" }),
    { repository },
  );
  await createEnquiryUseCase(
    createEnquiryInput({ studentName: "Other Match", source: "Referral" }),
    createEnquiryServiceContext({ tenantId: "tenant_a" }),
    { repository },
  );
  await updateEnquiryUseCase(String(created?.id ?? ""), { status: "CONTACTED" }, createEnquiryServiceContext({ tenantId: "tenant_a" }), { repository });
  const closedRecord = await createEnquiryUseCase(
    createEnquiryInput({ studentName: "Closed Match", source: "Walk-In" }),
    createEnquiryServiceContext({ tenantId: "tenant_a" }),
    { repository },
  );
  await closeEnquiryUseCase(String(closedRecord?.id ?? ""), createEnquiryServiceContext({ tenantId: "tenant_a" }), { repository });

  const byStatus = await listEnquiriesUseCase(createEnquiryServiceContext({ tenantId: "tenant_a" }), { repository }, { status: "CONTACTED" });
  const bySource = await listEnquiriesUseCase(createEnquiryServiceContext({ tenantId: "tenant_a" }), { repository }, { source: "walk-in" });
  const bySearch = await listEnquiriesUseCase(createEnquiryServiceContext({ tenantId: "tenant_a" }), { repository }, { search: "filter" });
  const byClosedStatus = await listEnquiriesUseCase(createEnquiryServiceContext({ tenantId: "tenant_a" }), { repository }, { status: "CLOSED" });

  assert.equal(byStatus.length, 1);
  assert.equal(byStatus[0]?.studentName, "Filter Match");
  assert.equal(bySource.length, 2);
  assert.equal(bySearch.length, 1);
  assert.equal(bySearch[0]?.studentName, "Filter Match");
  assert.equal(byClosedStatus.length, 1);
  assert.equal(byClosedStatus[0]?.status, "CLOSED");
});

test("list enquiries page returns stable tenant-scoped totals and boundaries", async () => {
  const repository = new InMemoryEnquiryRepository();
  for (const studentName of ["Aarav Rao", "Diya Shah", "Ishaan Mehta"]) {
    await createEnquiryUseCase(
      createEnquiryInput({ studentName }),
      createEnquiryServiceContext({ tenantId: "tenant_a" }),
      { repository },
    );
  }
  await createEnquiryUseCase(
    createEnquiryInput({ studentName: "Other Tenant" }),
    createEnquiryServiceContext({ tenantId: "tenant_b" }),
    { repository },
  );

  const first = await repository.listPage("tenant_a", { limit: 2, offset: 0 });
  const second = await repository.listPage("tenant_a", { limit: 2, offset: 2 });

  assert.equal(first.total, 3);
  assert.deepEqual(first.items.map((item) => item.studentName), ["Aarav Rao", "Diya Shah"]);
  assert.equal(second.total, 3);
  assert.deepEqual(second.items.map((item) => item.studentName), ["Ishaan Mehta"]);
});
