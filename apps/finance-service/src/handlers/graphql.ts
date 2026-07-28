import type { RequestContext } from "@school-erp/api";
import { normalizePermissions } from "@school-erp/auth";
import { ForbiddenError, NotFoundError, ValidationError, toGraphqlError } from "@school-erp/errors";
import { feeConfigurationPermissions } from "../modules/fee-configuration/fee-configuration.permissions";
import { paymentPermissions } from "../modules/payments/payments.permissions";
import { feeOrderPermissions } from "../modules/fee-orders/fee-orders.permissions";
import { getFeeOrder, listFeeOrderPage, listFeeOrders } from "../modules/fee-orders/fee-orders.service";
import { collectPayment, getReceipt, listPaymentPage, listPayments } from "../modules/payments/payments.service";
import { createFeeHead, createFeeMapping, createFeeSchedule, createFeeStructure, listFeeConfiguration, setFeeConfigurationStatus, updateFeeHead } from "../modules/fee-configuration/fee-configuration.service";
import { hydrateFinanceRuntimeConfig } from "./runtime-config";
import { financeDashboardPermissions } from "../modules/dashboard/finance-dashboard.permissions";
import { getFinanceDashboard } from "../modules/dashboard/finance-dashboard.service";
import { paymentAdjustmentPermissions } from "../modules/payment-adjustments/payment-adjustments.permissions";
import { createPaymentAdjustment, listPaymentAdjustments } from "../modules/payment-adjustments/payment-adjustments.service";
import { feeOrderRecoveryPermissions } from "../modules/fee-order-recovery/fee-order-recovery.permissions";
import { listFeeOrderRecoveries, retryFeeOrderRecovery } from "../modules/fee-order-recovery/fee-order-recovery.service";
import { receiptTemplatePermissions } from "../modules/receipt-template/receipt-template.permissions";
import { getReceiptTemplate, saveReceiptTemplate } from "../modules/receipt-template/receipt-template.service";
import { generalChargePermissions } from "../modules/general-charges/general-charges.permissions";
import { createGeneralCharge, listGeneralCharges } from "../modules/general-charges/general-charges.service";

interface Event { info: { fieldName: string }; arguments?: Record<string, unknown>; identity?: { sub?: string; claims?: Record<string, unknown> } | null; request?: { headers?: Record<string, string> }; }
const adminPermissions = [...Object.values(financeDashboardPermissions), ...Object.values(feeConfigurationPermissions), ...Object.values(feeOrderPermissions), ...Object.values(generalChargePermissions), ...Object.values(paymentPermissions), ...Object.values(paymentAdjustmentPermissions), ...Object.values(feeOrderRecoveryPermissions), ...Object.values(receiptTemplatePermissions)];
function claim(claims: Record<string, unknown>, ...names: string[]) { for (const name of names) { const value = claims[name]; if (typeof value === "string" && value.trim()) return value.trim(); } return undefined; }
function context(event: Event): RequestContext { const claims = event.identity?.claims ?? {}; const groupsValue = claims["cognito:groups"]; const groups = Array.isArray(groupsValue) ? groupsValue : typeof groupsValue === "string" ? groupsValue.split(",") : []; const role = claim(claims, "custom:role", "role") ?? (groups.includes("TENANT_ADMIN") ? "TENANT_ADMIN" : undefined); const userId = event.identity?.sub ?? claim(claims, "sub"); const tenantId = claim(claims, "custom:tenantId", "tenantId"); if (!userId || !tenantId) throw new ForbiddenError("authenticated tenant identity is required"); const permissions = normalizePermissions([...(role === "TENANT_ADMIN" ? adminPermissions : []), ...normalizePermissions(claims["custom:permissions"] ?? claims.permissions)]); return { requestId: event.request?.headers?.["x-amzn-trace-id"] ?? `gql_${crypto.randomUUID()}`, path: `graphql:${event.info.fieldName}`, method: "POST", headers: event.request?.headers ?? {}, query: {}, body: event.arguments ?? {}, params: {}, tenantContext: { tenantId, source: "jwt-claims", resolvedAt: new Date() }, authContext: { source: "jwt-claims", authenticatedAt: new Date(), user: { id: userId, role, permissions, source: "jwt-claims" } } }; }
function requiredObject(args: Record<string, unknown>, name: string) { const value = args[name]; if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError([{ field: name, message: `${name} is required` }]); return value; }
function requiredText(args: Record<string, unknown>, name: string) { const value = args[name]; if (typeof value !== "string" || !value.trim()) throw new ValidationError([{ field: name, message: `${name} is required` }]); return value.trim(); }

export async function handleFinanceGraphql(event: Event) { const ctx = context(event); const args = event.arguments ?? {}; switch (event.info.fieldName) {
  case "feeConfiguration": return listFeeConfiguration(requiredObject(args, "scope"), ctx);
  case "financeDashboard": return getFinanceDashboard(requiredObject(args, "scope"), ctx);
  case "financeReceipt": return getReceipt(requiredText(args, "paymentId"), ctx);
  case "financeReceiptTemplate": return getReceiptTemplate(ctx);
  case "financePayments": return listPayments(args.filter, ctx);
  case "financePaymentPage": return listPaymentPage(args.filter, ctx);
  case "financePaymentAdjustments": return listPaymentAdjustments(args.filter, ctx);
  case "feeOrderRecoveries": return listFeeOrderRecoveries(args.filter, ctx);
  case "feeOrders": return listFeeOrders(args.filter, ctx);
  case "feeOrderPage": return listFeeOrderPage(args.filter, ctx);
  case "generalCharges": return listGeneralCharges(args.filter, ctx);
  case "feeOrder": return getFeeOrder(requiredText(args, "id"), ctx);
  case "createFeeHead": return createFeeHead(requiredObject(args, "input"), ctx);
  case "updateFeeHead": return updateFeeHead(requiredText(args, "id"), requiredObject(args, "input"), ctx);
  case "createFeeSchedule": return createFeeSchedule(requiredObject(args, "input"), ctx);
  case "createFeeStructure": return createFeeStructure(requiredObject(args, "input"), ctx);
  case "createFeeMapping": return createFeeMapping(requiredObject(args, "input"), ctx);
  case "setFeeConfigurationStatus": return setFeeConfigurationStatus(requiredText(args, "entity") as "fee-head" | "schedule" | "structure" | "mapping", requiredText(args, "id"), requiredText(args, "status") as "ACTIVE" | "INACTIVE", ctx);
  case "collectFinancePayment": return collectPayment(requiredObject(args, "input"), ctx);
  case "createGeneralCharge": return createGeneralCharge(requiredObject(args, "input"), ctx);
  case "saveFinanceReceiptTemplate": return saveReceiptTemplate(requiredObject(args, "input"), ctx);
  case "createFinancePaymentAdjustment": return createPaymentAdjustment(requiredObject(args, "input"), ctx);
  case "retryFeeOrderRecovery": return retryFeeOrderRecovery(requiredText(args, "id"), ctx);
  default: throw new NotFoundError(`unsupported finance GraphQL field: ${event.info.fieldName}`);
} }
export async function handler(event: Event) { try { await hydrateFinanceRuntimeConfig(); return await handleFinanceGraphql(event); } catch (error) { throw toGraphqlError(error, event.request?.headers?.["x-amzn-trace-id"]); } }
