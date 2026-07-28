import type { RequestContext } from "@school-erp/api";
import type { Permission } from "@school-erp/auth";
import { BadRequestError, ForbiddenError } from "@school-erp/errors";
import { financeDashboardPermissions } from "./finance-dashboard.permissions";
import {
  financeDashboardRepository,
  type FinanceDashboardRepository,
} from "./finance-dashboard.repository";

export interface FinanceDashboardDependencies {
  reporting?: FinanceDashboardRepository | Promise<FinanceDashboardRepository>;
  now?: () => Date;
}
export async function getFinanceDashboard(
  scope: unknown,
  context: RequestContext,
  deps: FinanceDashboardDependencies = {},
) {
  if (
    !(context.authContext?.user?.permissions ?? []).includes(
      financeDashboardPermissions.read as Permission,
    )
  )
    throw new ForbiddenError(
      `permission ${financeDashboardPermissions.read} is required`,
    );
  const tenantId = context.tenantContext?.tenantId?.trim();
  if (!tenantId) throw new BadRequestError("tenantId is required");
  if (!scope || typeof scope !== "object" || Array.isArray(scope))
    throw new BadRequestError("finance dashboard scope is required");
  const value = scope as Record<string, unknown>;
  if (
    typeof value.campusId !== "string" ||
    !value.campusId.trim() ||
    typeof value.academicYearId !== "string" ||
    !value.academicYearId.trim()
  )
    throw new BadRequestError("campusId and academicYearId are required");
  const campusId = value.campusId.trim(),
    academicYearId = value.academicYearId.trim();
  const now = deps.now?.() ?? new Date(),
    today = now.toISOString().slice(0, 10);
  const summary = await (
    await (deps.reporting ?? financeDashboardRepository())
  ).summarize(tenantId, { campusId, academicYearId, today });
  return {
    campusId,
    academicYearId,
    ...summary,
    generatedAt: now.toISOString(),
  };
}
