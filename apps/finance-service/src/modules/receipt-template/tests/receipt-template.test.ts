import test from "node:test";
import assert from "node:assert/strict";
import type { RequestContext } from "@school-erp/api";
import { InMemoryReceiptTemplateRepository } from "../receipt-template.repository";
import { getReceiptTemplate, saveReceiptTemplate } from "../receipt-template.service";

function context(tenantId = "tenant_one"): RequestContext {
  return { requestId: "request", method: "POST", path: "/receipt-template", headers: {}, query: {}, body: {}, params: {}, tenantContext: { tenantId, source: "x-tenant-id", resolvedAt: new Date() }, authContext: { source: "headers", authenticatedAt: new Date(), user: { id: "admin_1", permissions: ["finance.receipt-template.read", "finance.receipt-template.manage"], source: "headers" } } };
}

test("returns a safe default and stores one tenant-isolated receipt template", async () => {
  const repository = new InMemoryReceiptTemplateRepository();
  const initial = await getReceiptTemplate(context(), { repository });
  assert.equal(initial.paperSize, "A4");
  const saved = await saveReceiptTemplate({ title: "Official fee receipt", headerText: "Payment acknowledged", footerText: "Thank you", signatureLabel: "Accounts officer", paperSize: "A4", accentColor: "#14532d", showInstitutionLogo: true, showInstitutionAddress: true, showPaymentMethod: true, showPaymentReference: false }, context(), { repository });
  assert.equal(saved.title, "Official fee receipt");
  assert.equal(saved.showPaymentReference, false);
  assert.equal((await getReceiptTemplate(context("tenant_two"), { repository })).title, "Fee payment receipt");
});

test("rejects invalid receipt presentation values", async () => {
  await assert.rejects(() => saveReceiptTemplate({ title: "Receipt", signatureLabel: "Signature", paperSize: "LETTER", accentColor: "green", showInstitutionLogo: true, showInstitutionAddress: true, showPaymentMethod: true, showPaymentReference: true }, context(), { repository: new InMemoryReceiptTemplateRepository() }), /Validation failed/);
});
