import type { Permission } from "@school-erp/auth";
import type { RequestContext } from "@school-erp/api";
import {
  toConfigurationView,
  toFeeHeadView,
  toMappingView,
  toScheduleView,
  toStructureView,
} from "../fee-configuration.mapper";
import { feeConfigurationPermissions } from "../fee-configuration.permissions";
import type { FeeConfigurationDependencies } from "../fee-configuration.shared";
import {
  actorId,
  permission,
  repository,
  tenantId,
} from "../fee-configuration.shared";
import {
  validateFeeHead,
  validateFeeMapping,
  validateFeeSchedule,
  validateFeeStructure,
  validateScope,
} from "../fee-configuration.validator";

export async function listFeeConfiguration(
  input: unknown,
  context: RequestContext,
  deps?: FeeConfigurationDependencies,
) {
  permission(context, feeConfigurationPermissions.read as Permission);
  return toConfigurationView(
    await (
      await repository(deps)
    ).snapshot(tenantId(context), validateScope(input)),
  );
}
export async function createFeeHead(
  input: unknown,
  context: RequestContext,
  deps?: FeeConfigurationDependencies,
) {
  permission(context, feeConfigurationPermissions.create as Permission);
  return toFeeHeadView(
    await (
      await repository(deps)
    ).createFeeHead(
      tenantId(context),
      actorId(context),
      validateFeeHead(input),
    ),
  );
}
export async function updateFeeHead(
  id: string,
  input: unknown,
  context: RequestContext,
  deps?: FeeConfigurationDependencies,
) {
  permission(context, feeConfigurationPermissions.update as Permission);
  return toFeeHeadView(
    await (
      await repository(deps)
    ).updateFeeHead(
      tenantId(context),
      id.trim(),
      actorId(context),
      validateFeeHead(input),
    ),
  );
}
export async function createFeeSchedule(
  input: unknown,
  context: RequestContext,
  deps?: FeeConfigurationDependencies,
) {
  permission(context, feeConfigurationPermissions.create as Permission);
  return toScheduleView(
    await (
      await repository(deps)
    ).createSchedule(
      tenantId(context),
      actorId(context),
      validateFeeSchedule(input),
    ),
  );
}
export async function createFeeStructure(
  input: unknown,
  context: RequestContext,
  deps?: FeeConfigurationDependencies,
) {
  permission(context, feeConfigurationPermissions.create as Permission);
  return toStructureView(
    await (
      await repository(deps)
    ).createStructure(
      tenantId(context),
      actorId(context),
      validateFeeStructure(input),
    ),
  );
}
export async function createFeeMapping(
  input: unknown,
  context: RequestContext,
  deps?: FeeConfigurationDependencies,
) {
  permission(context, feeConfigurationPermissions.create as Permission);
  return toMappingView(
    await (
      await repository(deps)
    ).createMapping(
      tenantId(context),
      actorId(context),
      validateFeeMapping(input),
    ),
  );
}
export async function setFeeConfigurationStatus(
  entity: "fee-head" | "schedule" | "structure" | "mapping",
  id: string,
  status: "ACTIVE" | "INACTIVE",
  context: RequestContext,
  deps?: FeeConfigurationDependencies,
) {
  permission(context, feeConfigurationPermissions.deactivate as Permission);
  return {
    updated: await (
      await repository(deps)
    ).setStatus(tenantId(context), entity, id, status, actorId(context)),
  };
}
