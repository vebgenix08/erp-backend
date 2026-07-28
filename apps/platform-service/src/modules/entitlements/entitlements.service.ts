import type { RequestContext } from "@school-erp/api";
import { requirePlatformPermission } from "../../middleware";
import { platformPermissions } from "../../permissions";
import type { TenantEntitlementRepository } from "./entitlements.repository";
import { createTenantEntitlementRepository } from "./entitlements.repository";
import { validateTenantEntitlementInput } from "./entitlements.validator";
import { ConflictError } from "@school-erp/errors";
import { getTenantCapabilityDefinition, isTenantCapabilityCode } from "../capability-catalog/capability-catalog.service";
export interface EntitlementDeps {
  repository?:
    | TenantEntitlementRepository
    | Promise<TenantEntitlementRepository>;
}
const view = (
  record: Awaited<ReturnType<TenantEntitlementRepository["upsert"]>>,
) => ({
  ...record,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});
export async function listTenantEntitlements(
  tenantId: string | undefined,
  context: RequestContext,
  deps: EntitlementDeps = {},
) {
  requirePlatformPermission(context, platformPermissions.entitlements.read);
  const repository = await (deps.repository ??
    createTenantEntitlementRepository());
  return (await repository.list(tenantId))
    .filter((record) => isTenantCapabilityCode(record.featureCode))
    .map(view);
}
export async function setTenantEntitlement(
  input: unknown,
  context: RequestContext,
  deps: EntitlementDeps = {},
) {
  requirePlatformPermission(context, platformPermissions.entitlements.manage);
  const repository = await (deps.repository ??
    createTenantEntitlementRepository());
  const payload = validateTenantEntitlementInput(input);
  const current = await repository.list(payload.tenantId);
  const enabled = new Set(
    current.filter((record) => record.status === "ENABLED").map((record) => record.featureCode),
  );

  if (payload.status === "ENABLED") {
    const missing = getTenantCapabilityDefinition(payload.featureCode).dependencies.filter(
      (dependency) => !enabled.has(dependency),
    );
    if (missing.length) {
      throw new ConflictError(`enable required capabilities first: ${missing.join(", ")}`);
    }
  } else {
    const dependents = current
      .filter((record) => record.status === "ENABLED" && record.featureCode !== payload.featureCode)
      .filter((record) => isTenantCapabilityCode(record.featureCode))
      .filter((record) => getTenantCapabilityDefinition(record.featureCode).dependencies.includes(payload.featureCode))
      .map((record) => record.featureCode);
    if (dependents.length) {
      throw new ConflictError(`disable dependent capabilities first: ${dependents.join(", ")}`);
    }
  }

  return view(await repository.upsert(payload));
}
