import type { RequestContext } from "@school-erp/api";
import { platformPermissions } from "../../permissions";
import { requirePlatformPermission } from "../../middleware";
import { toFeatureFlagView } from "./feature-flags.mapper";
import type { FeatureFlagRepository } from "./feature-flags.repository";
import { createFeatureFlagRepository } from "./feature-flags.repository";
import { validateFeatureFlagCreateInput, validateFeatureFlagUpdateInput } from "./feature-flags.validator";

export interface FeatureFlagServiceDeps {
  repository?: FeatureFlagRepository | Promise<FeatureFlagRepository>;
}

async function resolveRepository(deps?: FeatureFlagServiceDeps): Promise<FeatureFlagRepository> {
  return await (deps?.repository ?? createFeatureFlagRepository());
}

export async function listFeatureFlags(context: RequestContext, deps?: FeatureFlagServiceDeps) {
  requirePlatformPermission(context, platformPermissions.featureFlags.read);
  const repository = await resolveRepository(deps);
  return (await repository.list()).map((record) => toFeatureFlagView(record));
}

export async function getFeatureFlag(id: string, context: RequestContext, deps?: FeatureFlagServiceDeps) {
  requirePlatformPermission(context, platformPermissions.featureFlags.read);
  const repository = await resolveRepository(deps);
  return toFeatureFlagView(await repository.getById(id));
}

export async function createFeatureFlag(input: unknown, context: RequestContext, deps?: FeatureFlagServiceDeps) {
  requirePlatformPermission(context, platformPermissions.featureFlags.create);
  const repository = await resolveRepository(deps);
  return toFeatureFlagView(await repository.create(validateFeatureFlagCreateInput(input)));
}

export async function updateFeatureFlag(id: string, input: unknown, context: RequestContext, deps?: FeatureFlagServiceDeps) {
  requirePlatformPermission(context, platformPermissions.featureFlags.update);
  const repository = await resolveRepository(deps);
  return toFeatureFlagView(await repository.update(id, validateFeatureFlagUpdateInput(input)));
}
