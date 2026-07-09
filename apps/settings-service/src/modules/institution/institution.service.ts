import type { StructuredLogger } from "@school-erp/logger";
import { requireAuth, requirePermission } from "@school-erp/auth";
import { requireTenantId } from "@school-erp/tenancy";
import type { RequestContext } from "@school-erp/api";
import { institutionPermissions } from "./institution.permissions";
import { toInstitutionProfileView } from "./institution.mapper";
import { institutionRepository as defaultRepository, type InstitutionRepository } from "./institution.repository";
import { validateInstitutionProfileInput, validateInstitutionProfileUpdateInput } from "./institution.validator";
import type { InstitutionProfileView } from "./institution.model";

export interface InstitutionServiceDeps {
  repository?: InstitutionRepository;
  logger?: StructuredLogger;
}

function resolveRepository(deps?: InstitutionServiceDeps): InstitutionRepository {
  return deps?.repository ?? defaultRepository;
}

function log(deps: InstitutionServiceDeps | undefined, context: RequestContext, message: string) {
  const logger = deps?.logger;
  if (!logger) return;
  logger.withContext({
    requestId: context.requestId,
    tenantId: context.tenantContext?.tenantId,
    userId: context.authContext?.user?.id,
  }).info(message);
}

function getTenantId(context: RequestContext): string {
  return requireTenantId(context.tenantContext);
}

function requireActor(context: RequestContext): void {
  requireAuth(context.authContext);
}

export async function getInstitutionProfile(context: RequestContext, deps?: InstitutionServiceDeps): Promise<InstitutionProfileView | null> {
  requireActor(context);
  requirePermission(context.authContext, institutionPermissions.read);
  const record = await resolveRepository(deps).getById(getTenantId(context), "institution");
  return toInstitutionProfileView(record);
}

export async function updateInstitutionProfile(
  input: unknown,
  context: RequestContext,
  deps?: InstitutionServiceDeps,
): Promise<InstitutionProfileView> {
  requireActor(context);
  requirePermission(context.authContext, institutionPermissions.update);
  const repository = resolveRepository(deps);
  const tenantId = getTenantId(context);
  const payload = validateInstitutionProfileUpdateInput(input);
  const existing = await repository.getById(tenantId, "institution");
  const updated = existing
    ? await repository.update(tenantId, "institution", payload)
    : await repository.create(tenantId, validateInstitutionProfileInput({ ...payload, name: payload.name ?? "Institution" }));
  log(deps, context, "institution.profile.updated");
  return toInstitutionProfileView(updated) as InstitutionProfileView;
}
