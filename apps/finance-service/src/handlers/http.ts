import type { ApiRequest } from "@school-erp/api";
import { createFinanceApp } from "../app";
const app = createFinanceApp();
export async function handleFinanceHttp(request: ApiRequest) { return app.handle(request); }
