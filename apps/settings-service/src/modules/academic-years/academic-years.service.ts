import type { RequestContext } from "@school-erp/api";
import { requireAuth, requirePermission } from "@school-erp/auth";
import { BadRequestError, ConflictError } from "@school-erp/errors";
import type { StructuredLogger } from "@school-erp/logger";
import { requireTenantId } from "@school-erp/tenancy";
import { academicYearPermissions } from "./academic-years.permissions";
import { academicYearRepository as defaultRepository, type AcademicYearRepository } from "./academic-years.repository";
import { toAcademicYearView } from "./academic-years.mapper";
import { validateAcademicYearCreateInput, validateAcademicYearListFilter, validateAcademicYearUpdateInput } from "./academic-years.validator";
import type { AcademicYearListFilter, AcademicYearView } from "./academic-years.model";

export interface AcademicYearServiceDeps {
  repository?: AcademicYearRepository;
  logger?: StructuredLogger;
}

function resolveRepository(deps?: AcademicYearServiceDeps): AcademicYearRepository {
  return deps?.repository ?? defaultRepository;
}

function getTenantId(context: RequestContext): string {
  return requireTenantId(context.tenantContext);
}

function ensure(context: RequestContext, permission: string): void {
  requireAuth(context.authContext);
  requirePermission(context.authContext, permission);
}

function log(deps: AcademicYearServiceDeps | undefined, context: RequestContext, message: string): void {
  const logger = deps?.logger;
  if (!logger) return;
  logger.withContext({
    requestId: context.requestId,
    tenantId: context.tenantContext?.tenantId,
    userId: context.authContext?.user?.id,
  }).info(message);
}

export async function listAcademicYears(
  context: RequestContext,
  deps?: AcademicYearServiceDeps,
  filter?: AcademicYearListFilter,
): Promise<AcademicYearView[]> {
  ensure(context, academicYearPermissions.read);
  const records = await resolveRepository(deps).list(getTenantId(context), validateAcademicYearListFilter(filter));
  return records.map((record) => toAcademicYearView(record) as AcademicYearView);
}

export async function getAcademicYear(context: RequestContext, id: string, deps?: AcademicYearServiceDeps): Promise<AcademicYearView | null> {
  ensure(context, academicYearPermissions.read);
  return toAcademicYearView(await resolveRepository(deps).getById(getTenantId(context), id));
}

export async function createAcademicYear(context: RequestContext, input: unknown, deps?: AcademicYearServiceDeps): Promise<AcademicYearView> {
  ensure(context, academicYearPermissions.create);
  const repository = resolveRepository(deps);
  const tenantId = getTenantId(context);
  const payload = validateAcademicYearCreateInput(input);
  const duplicate = await repository.getByCode(tenantId, payload.code);
  if (duplicate) {
    throw new ConflictError("academic year code must be unique");
  }
  const created = await repository.create(tenantId, payload);
  const existingYears = await repository.list(tenantId);
  const initialized = existingYears.length === 1 ? await repository.activate(tenantId, created.id) : created;
  log(deps, context, `academic-year.created:${created.code}`);
  return toAcademicYearView(initialized) as AcademicYearView;
}

export async function updateAcademicYear(
  context: RequestContext,
  id: string,
  input: unknown,
  deps?: AcademicYearServiceDeps,
): Promise<AcademicYearView | null> {
  ensure(context, academicYearPermissions.update);
  const repository = resolveRepository(deps);
  const tenantId = getTenantId(context);
  const existing = await repository.getById(tenantId, id);
  if (!existing) return null;
  if (existing.status === "CLOSED") throw new BadRequestError("closed academic years cannot be edited; reopen it first");
  const payload = validateAcademicYearUpdateInput(input);
  if (payload.code) {
    const duplicate = await repository.getByCode(tenantId, payload.code);
    if (duplicate && duplicate.id !== id) {
      throw new ConflictError("academic year code must be unique");
    }
  }
  const updated = await repository.update(tenantId, id, payload);
  log(deps, context, `academic-year.updated:${existing.code}`);
  return toAcademicYearView(updated);
}

export async function activateAcademicYear(context: RequestContext, id: string, deps?: AcademicYearServiceDeps): Promise<AcademicYearView | null> {
  ensure(context, academicYearPermissions.activate);
  const repository = resolveRepository(deps);
  const tenantId = getTenantId(context);
  const existing = await repository.getById(tenantId, id);
  if (!existing) return null;
  if (existing.status === "CLOSED") throw new BadRequestError("closed academic year must be reopened before activation");
  const updated = await repository.activate(tenantId, id);
  log(deps, context, `academic-year.activated:${existing.code}`);
  return toAcademicYearView(updated);
}

function requireReason(input: unknown): string { const reason = typeof input === "string" ? input.trim() : ""; if (reason.length < 5) throw new BadRequestError("a lifecycle reason of at least 5 characters is required"); return reason; }
export async function closeAcademicYear(context:RequestContext,id:string,reason:unknown,deps?:AcademicYearServiceDeps){ensure(context,academicYearPermissions.close);const repository=resolveRepository(deps);const tenantId=getTenantId(context);const existing=await repository.getById(tenantId,id);if(!existing)return null;if(existing.status!=="ACTIVE")throw new BadRequestError("only the active academic year can be closed");const updated=await repository.close(tenantId,id,requireReason(reason));log(deps,context,`academic-year.closed:${existing.code}`);return toAcademicYearView(updated);}
export async function reopenAcademicYear(context:RequestContext,id:string,reason:unknown,deps?:AcademicYearServiceDeps){ensure(context,academicYearPermissions.reopen);const repository=resolveRepository(deps);const tenantId=getTenantId(context);const existing=await repository.getById(tenantId,id);if(!existing)return null;if(existing.status!=="CLOSED")throw new BadRequestError("only a closed academic year can be reopened");const updated=await repository.reopen(tenantId,id,requireReason(reason));log(deps,context,`academic-year.reopened:${existing.code}`);return toAcademicYearView(updated);}
