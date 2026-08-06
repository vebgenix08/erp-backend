import type { RequestContext } from "@school-erp/api";
import { requirePermission } from "@school-erp/auth";
import { requireTenant } from "@school-erp/tenancy";
import { ValidationError } from "@school-erp/errors";
import { adminDashboardPermissions } from "./admin-dashboard.permissions";
import { readAdminDashboard } from "./admin-dashboard.repository";

export async function getAdminDashboard(
  input: Record<string, unknown>,
  context: RequestContext,
) {
  requirePermission(context.authContext, adminDashboardPermissions.read);
  const tenant = requireTenant(context.tenantContext);
  if (!tenant.tenantId) {
    throw new ValidationError([{ field: "tenantId", message: "tenant context is required" }]);
  }
  const campusId = typeof input.campusId === "string" ? input.campusId.trim() : "";
  const academicYearId = typeof input.academicYearId === "string" ? input.academicYearId.trim() : "";
  if (!campusId || !academicYearId) {
    throw new ValidationError([
      ...(!campusId ? [{ field: "campusId", message: "campusId is required" }] : []),
      ...(!academicYearId ? [{ field: "academicYearId", message: "academicYearId is required" }] : []),
    ]);
  }
  const now = new Date();
  const from = typeof input.from === "string" ? new Date(input.from) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = typeof input.to === "string" ? new Date(input.to) : now;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    throw new ValidationError([{ field: "dateRange", message: "A valid date range is required" }]);
  }
  const result = await readAdminDashboard(tenant.tenantId, { campusId, academicYearId, from, to });
  return {
    ...result,
    recentApplications: result.recentApplications.map((item) => ({
      ...item,
      updatedAt: item.updatedAt.toISOString(),
    })),
    recentSecurityChanges: result.recentSecurityChanges.map((item) => ({
      ...item,
      occurredAt: item.occurredAt.toISOString(),
    })),
    recentActivity: result.recentActivity.map((item) => ({ ...item, occurredAt: item.occurredAt.toISOString() })),
    generatedAt: result.generatedAt.toISOString(),
  };
}
