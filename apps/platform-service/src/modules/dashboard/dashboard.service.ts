import type { RequestContext } from "@school-erp/api";
import { platformPermissions } from "../../permissions";
import { requirePlatformPermission } from "../../middleware";
import type { DashboardRepositoryDeps } from "./dashboard.repository";
import { DashboardRepository } from "./dashboard.repository";

export async function getPlatformDashboardSummary(context: RequestContext, deps?: DashboardRepositoryDeps) {
  requirePlatformPermission(context, platformPermissions.dashboard.read);
  const repository = new DashboardRepository(deps);
  return repository.getSummary();
}
