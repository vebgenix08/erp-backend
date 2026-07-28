import type { RequestContext } from "@school-erp/api";
import type { Permission } from "@school-erp/auth";
import { NotFoundError } from "@school-erp/errors";
import { toPaymentView, toReceiptView } from "../payments.mapper";
import { paymentPermissions } from "../payments.permissions";
import type { PaymentDependencies } from "../payments.shared";
import {
  actorId,
  repository,
  requirePermission,
  tenantId,
} from "../payments.shared";
import {
  validateCollectPayment,
  validatePaymentFilter,
} from "../payments.validator";
import { defaultReceiptTemplate, receiptTemplateRepository } from "../../receipt-template/receipt-template.repository";
import { feeOrderRepository } from "../../fee-orders/fee-orders.repository";
import { getReceiptBranding } from "../receipt-branding.repository";
import { renderReceiptPdf } from "../receipt-pdf.renderer";
import type { ReceiptDocument } from "../payments.model";

async function loadReceipt(paymentId: string, context: RequestContext, deps?: PaymentDependencies) {
  requirePermission(context, paymentPermissions.readReceipt as Permission);
  const tenant = tenantId(context);
  const payment = await (await repository(deps)).getById(tenant, paymentId.trim());
  if (!payment) throw new NotFoundError("receipt was not found");
  const [templates, orders] = await Promise.all([
    deps?.receiptTemplateRepository ?? receiptTemplateRepository(),
    deps?.feeOrderRepository ?? feeOrderRepository(),
  ]);
  const [template, receiptOrders] = await Promise.all([
    templates.get(tenant),
    Promise.all(payment.allocations.map((allocation) => orders.getById(tenant, allocation.feeOrderId)))
      .then((records) => records.filter((order) => order !== null)),
  ]);
  const firstOrder = receiptOrders[0];
  const branding = await (deps?.receiptBranding ?? getReceiptBranding(
    tenant,
    payment.campusId,
    payment.academicYearId,
    firstOrder?.classId,
    firstOrder?.sectionId,
    payment.studentId,
    payment.collectedBy,
  ));
  return { payment, template: template ?? defaultReceiptTemplate(tenant), receiptOrders, branding };
}

export async function collectPayment(
  input: unknown,
  context: RequestContext,
  deps?: PaymentDependencies,
) {
  requirePermission(context, paymentPermissions.collect as Permission);
  return toPaymentView(
    await (
      await repository(deps)
    ).collect(
      tenantId(context),
      actorId(context),
      validateCollectPayment(input),
    ),
  );
}
export async function getReceipt(
  paymentId: string,
  context: RequestContext,
  deps?: PaymentDependencies,
) {
  const source = await loadReceipt(paymentId, context, deps);
  return toReceiptView(source.payment, source.template, source.receiptOrders, source.branding);
}
export async function getReceiptDocument(
  paymentId: string,
  context: RequestContext,
  deps?: PaymentDependencies,
  copyMode: "STUDENT" | "BOTH" = "STUDENT",
): Promise<ReceiptDocument> {
  const source = await loadReceipt(paymentId, context, deps);
  return {
    bytes: await renderReceiptPdf({
      payment: source.payment,
      template: source.template,
      orders: source.receiptOrders,
      branding: source.branding,
      copyMode,
    }),
    contentType: "application/pdf",
    fileName: `${source.payment.receiptNumber.replace(/[^A-Za-z0-9_-]/g, "-")}.pdf`,
  };
}
export async function listPayments(
  filter: unknown,
  context: RequestContext,
  deps?: PaymentDependencies,
) {
  requirePermission(context, paymentPermissions.read as Permission);
  return (
    await (
      await repository(deps)
    ).list(tenantId(context), validatePaymentFilter(filter))
  ).map(toPaymentView);
}

export async function listPaymentPage(filter: unknown, context: RequestContext, deps?: PaymentDependencies) {
  requirePermission(context, paymentPermissions.read as Permission);
  const page = await (await repository(deps)).listPage(tenantId(context), validatePaymentFilter(filter));
  return { ...page, items: page.items.map(toPaymentView) };
}
