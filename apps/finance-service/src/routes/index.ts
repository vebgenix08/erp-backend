import type { ApiRouter } from "@school-erp/api";
import { registerFeeConfigurationRoutes } from "../modules/fee-configuration/fee-configuration.routes";
import { registerPaymentRoutes } from "../modules/payments/payments.routes";
import { registerFeeOrderRoutes } from "../modules/fee-orders/fee-orders.routes";
import { registerFinanceDashboardRoutes } from "../modules/dashboard/finance-dashboard.routes";
import { registerPaymentAdjustmentRoutes } from "../modules/payment-adjustments/payment-adjustments.routes";
import { registerFeeOrderRecoveryRoutes } from "../modules/fee-order-recovery/fee-order-recovery.routes";
import { registerReceiptTemplateRoutes } from "../modules/receipt-template/receipt-template.routes";
import { registerGeneralChargeRoutes } from "../modules/general-charges/general-charges.routes";
export function registerFinanceRoutes(router: ApiRouter) { registerFinanceDashboardRoutes(router); registerFeeConfigurationRoutes(router); registerFeeOrderRoutes(router); registerGeneralChargeRoutes(router); registerPaymentRoutes(router); registerPaymentAdjustmentRoutes(router); registerFeeOrderRecoveryRoutes(router); registerReceiptTemplateRoutes(router); return router; }
