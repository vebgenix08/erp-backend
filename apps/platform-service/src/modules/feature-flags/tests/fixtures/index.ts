import type { RequestContext } from "@school-erp/api";
import { createPlatformContext } from "../../../dashboard/tests/fixtures";

export { createPlatformContext };

export function createFeatureFlagContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return createPlatformContext({
    path: "/feature-flags",
    ...overrides,
  });
}
