import type { RequestContext } from "@school-erp/api";
import type { Permission } from "@school-erp/auth";
import { ForbiddenError, UnauthorizedError } from "@school-erp/errors";
import {
  paymentRepository,
  type PaymentRepository,
} from "./payments.repository";
import type { ReceiptTemplateRepository } from "../receipt-template/receipt-template.repository";
import type { FeeOrderRepository } from "../fee-orders/fee-orders.repository";
import type { ReceiptBranding } from "./receipt-branding.repository";
export interface PaymentDependencies {
  repository?: PaymentRepository | Promise<PaymentRepository>;
  receiptTemplateRepository?: ReceiptTemplateRepository | Promise<ReceiptTemplateRepository>;
  feeOrderRepository?: FeeOrderRepository | Promise<FeeOrderRepository>;
  receiptBranding?: ReceiptBranding | Promise<ReceiptBranding>;
}
export const repository = async (deps?: PaymentDependencies) =>
  await (deps?.repository ?? paymentRepository());
export const tenantId = (context: RequestContext) => {
  const value = context.tenantContext?.tenantId?.trim();
  if (!value) throw new UnauthorizedError("tenant context is required");
  return value;
};
export const actorId = (context: RequestContext) => {
  const value = context.authContext?.user?.id?.trim();
  if (!value) throw new UnauthorizedError("authenticated user is required");
  return value;
};
export const requirePermission = (
  context: RequestContext,
  required: Permission,
) => {
  if (!(context.authContext?.user?.permissions ?? []).includes(required))
    throw new ForbiddenError(`permission ${required} is required`);
};
