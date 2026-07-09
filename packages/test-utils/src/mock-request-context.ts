import type { LoggerContext } from "@school-erp/logger";

export interface MockRequestContext extends LoggerContext {
  requestId: string;
  tenantId?: string;
  userId?: string;
}

export function createMockRequestContext(overrides: Partial<MockRequestContext> = {}): MockRequestContext {
  return {
    requestId: "req_test_1",
    tenantId: "tenant_test_1",
    userId: "user_test_1",
    ...overrides,
  };
}
