import type { PaymentRecord, ReceiptView } from "./payments.model";
import type { ReceiptTemplateRecord } from "../receipt-template/receipt-template.model";
import type { FeeOrderRecord } from "../fee-orders/fee-orders.model";
import type { ReceiptBranding } from "./receipt-branding.repository";
export function toPaymentView(record: PaymentRecord) {
  return {
    ...record,
    reversedMinor: record.reversedMinor ?? 0,
    allocations: record.allocations.map((item) => ({
      ...item,
      chargeAllocations: (item.chargeAllocations ?? []).map((charge) => ({
        ...charge,
      })),
    })),
    paidAt: record.paidAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value / 100);
const smallNumbers = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function underThousand(value: number): string {
  const parts: string[] = [];
  if (value >= 100) { parts.push(`${smallNumbers[Math.floor(value / 100)]} Hundred`); value %= 100; }
  if (value >= 20) { parts.push(tens[Math.floor(value / 10)] ?? ""); value %= 10; }
  if (value > 0) parts.push(smallNumbers[value] ?? "");
  return parts.filter(Boolean).join(" ");
}
function amountInWords(minor: number): string {
  let value = Math.floor(minor / 100);
  if (!value) return "Zero Rupees Only";
  const parts: string[] = [];
  const units: Array<[number, string]> = [[10_000_000, "Crore"], [100_000, "Lakh"], [1_000, "Thousand"]];
  for (const [unit, label] of units) {
    if (value >= unit) { const count = Math.floor(value / unit); parts.push(`${underThousand(count)} ${label}`); value %= unit; }
  }
  if (value) parts.push(underThousand(value));
  return `${parts.join(" ")} Rupees Only`;
}
const displayDate = (value: Date) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(value);
export function toReceiptView(record: PaymentRecord, template: ReceiptTemplateRecord, orders: FeeOrderRecord[] = [], branding: ReceiptBranding): ReceiptView {
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const particulars = record.allocations.flatMap((allocation) => [
    { label: allocation.label, amountMinor: allocation.amountMinor },
    ...allocation.chargeAllocations.map((charge) => ({
      label: `  ${charge.label}`,
      amountMinor: charge.amountMinor,
    })),
  ]);
  const lines = particulars.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td class="amount">${escapeHtml(money(item.amountMinor))}</td></tr>`).join("");
  const firstOrder = orderById.get(record.allocations[0]?.feeOrderId ?? "");
  const totalFeeMinor = orders.reduce((sum, order) => sum + order.totalMinor, 0) || record.amountMinor;
  const paidToDateMinor = orders.reduce((sum, order) => sum + order.paidMinor, 0) || record.amountMinor;
  const balanceMinor = orders.reduce((sum, order) => sum + order.balanceMinor, 0);
  const methodLabel = record.method.replaceAll("_", " ");
  const reference = template.showPaymentReference ? escapeHtml(record.reference ?? "—") : "Hidden";
  const method = template.showPaymentMethod ? escapeHtml(methodLabel) : "Hidden";
  const note = record.note
    ? `<p><strong>Note:</strong> ${escapeHtml(record.note)}</p>`
    : "";
  const institutionName=escapeHtml(branding.institutionName);
  const institutionAddress=template.showInstitutionAddress?escapeHtml([branding.campusName,branding.address,branding.contactPhone,branding.contactEmail].filter(Boolean).join(" · ")):"";
  const watermark=template.showInstitutionLogo?`<div class="watermark">${escapeHtml(branding.shortName??branding.institutionName)}</div>`:"";
  const documentHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(record.receiptNumber)}</title><style>@page{size:${template.paperSize === "THERMAL_80MM" ? "80mm auto" : template.paperSize};margin:10mm}body{font:12px Arial;color:#111827}.receipt{position:relative;max-width:720px;margin:auto;padding:18px;border:1px solid #94a3b8}.watermark{position:absolute;inset:45% 0 auto;text-align:center;font-size:48px;font-weight:bold;color:#0f766e;opacity:.06;transform:rotate(-25deg)}.institution{text-align:center;border-bottom:2px solid ${template.accentColor};padding-bottom:10px}.institution strong{display:block;font-size:19px}.institution p{margin:4px}.particulars{width:100%;border-collapse:collapse;margin-top:12px}.particulars th,.particulars td{border:1px solid #94a3b8;padding:7px}.amount{text-align:right}.summary{margin-top:12px;font-weight:bold}.footer{text-align:center;margin-top:30px}</style></head><body><main class="receipt">${watermark}<header class="institution"><strong>${institutionName}</strong><p>${institutionAddress}</p></header><h1>${escapeHtml(template.title)}</h1><p>Receipt: <strong>${escapeHtml(record.receiptNumber)}</strong> · Student: <strong>${escapeHtml(record.studentName)}</strong> · Date: ${escapeHtml(displayDate(record.paidAt))}</p><table class="particulars"><thead><tr><th>Particulars</th><th class="amount">Amount</th></tr></thead><tbody>${lines}</tbody></table><p class="summary">Paid now: ${escapeHtml(money(record.amountMinor))} · Total paid: ${escapeHtml(money(paidToDateMinor))} · Balance: ${escapeHtml(money(balanceMinor))}</p><p>Amount in words: ${escapeHtml(amountInWords(record.amountMinor))}</p><p>Mode: ${method} · Reference: ${reference} · Collected by: ${escapeHtml(record.collectedBy)}</p>${note}<p class="footer">${escapeHtml(template.footerText??"Computer-generated receipt")} · ${escapeHtml(template.signatureLabel)}</p></main></body></html>`;
  const receipt: ReceiptView = {
    receiptNumber: record.receiptNumber,
    paymentId: record.id,
    status: record.status,
    student: { id: record.studentId, name: record.studentName },
    campusId: record.campusId,
    academicYearId: record.academicYearId,
    currency: record.currency,
    amountMinor: record.amountMinor,
    method: record.method,
    allocations: record.allocations.map((item) => ({ ...item })),
    paidAt: record.paidAt.toISOString(),
    issuedAt: record.createdAt.toISOString(),
    collectedBy: record.collectedBy,
    fileName: `${record.receiptNumber.replace(/[^A-Za-z0-9_-]/g, "-")}.pdf`,
    documentHtml,
    paperSize: template.paperSize,
  };
  if (record.reference) receipt.reference = record.reference;
  if (record.note) receipt.note = record.note;
  return receipt;
}
