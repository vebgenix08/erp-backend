import type { RequestContext } from "@school-erp/api";
import { createPlatformContext } from "../../../dashboard/tests/fixtures";

export { createPlatformContext };

export function createAuditLogContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return createPlatformContext({
    path: "/audit-logs",
    ...overrides,
  });
}
