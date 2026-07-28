import type { RequestContext } from "@school-erp/api";
import { requirePlatformPermission } from "../../middleware";
import { platformPermissions } from "../../permissions";
import {
  createPlatformIntegrationRepository,
  type PlatformIntegrationRepository,
} from "./integrations.repository";
import { validatePlatformIntegrationInput } from "./integrations.validator";
export interface IntegrationDeps {
  repository?:
    | PlatformIntegrationRepository
    | Promise<PlatformIntegrationRepository>;
}
const view = (
  x: Awaited<ReturnType<PlatformIntegrationRepository["upsert"]>>,
) => ({
  ...x,
  createdAt: x.createdAt.toISOString(),
  updatedAt: x.updatedAt.toISOString(),
});
export async function listPlatformIntegrations(
  ctx: RequestContext,
  deps: IntegrationDeps = {},
) {
  requirePlatformPermission(ctx, platformPermissions.integrations.read);
  const r = await (deps.repository ?? createPlatformIntegrationRepository());
  return (await r.list()).map(view);
}
export async function setPlatformIntegration(
  input: unknown,
  ctx: RequestContext,
  deps: IntegrationDeps = {},
) {
  requirePlatformPermission(ctx, platformPermissions.integrations.manage);
  const r = await (deps.repository ?? createPlatformIntegrationRepository());
  return view(await r.upsert(validatePlatformIntegrationInput(input)));
}
