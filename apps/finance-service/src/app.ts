import { createRouter } from "@school-erp/api";
import { registerFinanceRoutes } from "./routes";
export function createFinanceApp() { const router = createRouter(); return registerFinanceRoutes(router); }
export const financeApp = createFinanceApp();
