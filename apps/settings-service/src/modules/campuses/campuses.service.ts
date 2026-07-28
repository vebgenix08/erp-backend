import type { RequestContext } from "@school-erp/api";
import { requireAuth, requirePermission } from "@school-erp/auth";
import type { StructuredLogger } from "@school-erp/logger";
import { requireTenantId } from "@school-erp/tenancy";
import { campusPermissions } from "./campuses.permissions";
import { toCampusView } from "./campuses.mapper";
import { campusRepository as defaultRepository, type CampusRepository } from "./campuses.repository";
import { validateCampusCreateInput, validateCampusListFilter, validateCampusUpdateInput } from "./campuses.validator";
import type { CampusListFilter, CampusView } from "./campuses.model";
import { BadRequestError, ConflictError } from "@school-erp/errors";

export interface CampusServiceDeps {
  repository?: CampusRepository;
  logger?: StructuredLogger;
}

function resolveRepository(deps?: CampusServiceDeps): CampusRepository {
  return deps?.repository ?? defaultRepository;
}

function getTenantId(context: RequestContext): string {
  return requireTenantId(context.tenantContext);
}

function ensure(context: RequestContext, permission: string): void {
  requireAuth(context.authContext);
  requirePermission(context.authContext, permission);
}

function log(deps: CampusServiceDeps | undefined, context: RequestContext, message: string): void {
  const logger = deps?.logger;
  if (!logger) return;
  logger.withContext({
    requestId: context.requestId,
    tenantId: context.tenantContext?.tenantId,
    userId: context.authContext?.user?.id,
  }).info(message);
}

export async function listCampuses(
  context: RequestContext,
  deps?: CampusServiceDeps,
  filter?: CampusListFilter,
): Promise<CampusView[]> {
  ensure(context, campusPermissions.read);
  const records = await resolveRepository(deps).list(getTenantId(context), validateCampusListFilter(filter));
  return records.map((record) => toCampusView(record) as CampusView);
}

export async function getCampus(context: RequestContext, id: string, deps?: CampusServiceDeps): Promise<CampusView | null> {
  ensure(context, campusPermissions.read);
  return toCampusView(await resolveRepository(deps).getById(getTenantId(context), id));
}

export async function createCampus(context: RequestContext, input: unknown, deps?: CampusServiceDeps): Promise<CampusView> {
  ensure(context, campusPermissions.create);
  const repository = resolveRepository(deps);
  const tenantId = getTenantId(context);
  const payload = validateCampusCreateInput(input);
  const duplicate = (await repository.list(tenantId)).some((campus) => campus.name.trim().toLowerCase().replace(/\s+/g, " ") === payload.name.trim().toLowerCase().replace(/\s+/g, " "));
  if (duplicate) throw new ConflictError("campus name must be unique within the tenant");
  const code = await repository.reserveNextCode(tenantId);
  const created = await repository.create(tenantId, { ...payload, code });
  log(deps, context, `campus.created:${created.code}`);
  return toCampusView(created) as CampusView;
}

export async function updateCampus(
  context: RequestContext,
  id: string,
  input: unknown,
  deps?: CampusServiceDeps,
): Promise<CampusView | null> {
  ensure(context, campusPermissions.update);
  const repository = resolveRepository(deps);
  const tenantId = getTenantId(context);
  const existing = await repository.getById(tenantId, id);
  if (!existing) return null;
  const payload = validateCampusUpdateInput(input);
  if (payload.name && (await repository.list(tenantId)).some((campus) => campus.id !== id && campus.name.trim().toLowerCase().replace(/\s+/g, " ") === payload.name!.trim().toLowerCase().replace(/\s+/g, " "))) throw new ConflictError("campus name must be unique within the tenant");
  const updated = await repository.update(tenantId, id, payload);
  log(deps, context, `campus.updated:${existing.code}`);
  return toCampusView(updated);
}

export async function deactivateCampus(context: RequestContext, id: string, deps?: CampusServiceDeps): Promise<CampusView | null> {
  ensure(context, campusPermissions.deactivate);
  const repository = resolveRepository(deps);
  const tenantId = getTenantId(context);
  const existing = await repository.getById(tenantId, id);
  if (!existing) return null;
  if (existing.status === "INACTIVE") return toCampusView(existing);
  const activeCampuses = await repository.list(tenantId, { status: "ACTIVE" });
  if (activeCampuses.length <= 1) throw new BadRequestError("the only active campus cannot be deactivated");
  const updated = await repository.deactivate(tenantId, id);
  log(deps, context, `campus.deactivated:${existing.code}`);
  return toCampusView(updated);
}

export async function reactivateCampus(context: RequestContext, id: string, deps?: CampusServiceDeps): Promise<CampusView | null> {
  ensure(context, campusPermissions.activate);
  const repository = resolveRepository(deps);
  const tenantId = getTenantId(context);
  const existing = await repository.getById(tenantId, id);
  if (!existing) return null;
  const updated = await repository.reactivate(tenantId, id);
  log(deps, context, `campus.reactivated:${existing.code}`);
  return toCampusView(updated);
}
