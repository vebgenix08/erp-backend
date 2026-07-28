import { ConflictError } from "@school-erp/errors";
import { requireAuth, requirePermission } from "@school-erp/auth";
import { requireTenantId } from "@school-erp/tenancy";
import type { RequestContext } from "@school-erp/api";
import { templatePermissions } from "./templates.permissions";
import { toTemplateView } from "./templates.mapper";
import type { TemplateRepository } from "./templates.repository";
import { templateRepository as defaultRepository } from "./templates.repository";
import { validateTemplateCreateInput, validateTemplateListFilter, validateTemplateUpdateInput } from "./templates.validator";
import type { TemplateRecord, TemplateServiceContext, TemplateView } from "./templates.model";

export interface TemplateServiceDeps {
  repository?: TemplateRepository | Promise<TemplateRepository>;
}

function resolveRepository(deps?: TemplateServiceDeps): TemplateRepository | Promise<TemplateRepository> {
  return deps?.repository ?? defaultRepository;
}

function getTenantId(context: TemplateServiceContext | RequestContext): string {
  return requireTenantId(context.tenantContext);
}

function assertAuth(context: TemplateServiceContext | RequestContext): void {
  requireAuth(context.authContext);
}

function assertPermission(context: TemplateServiceContext | RequestContext, permission: string): void {
  requirePermission(context.authContext, permission);
}

function ensureRequiredSystemKeys(template: TemplateRecord): void {
  const fieldKeys = new Set(template.fields.map((field) => field.key));
  const missing = template.requiredSystemKeys.filter((key) => !fieldKeys.has(key));
  if (missing.length > 0) {
    throw new ConflictError(`missing required system keys: ${missing.join(", ")}`);
  }
}

export async function createTemplate(
  input: unknown,
  context: TemplateServiceContext | RequestContext,
  deps?: TemplateServiceDeps,
): Promise<TemplateView> {
  assertAuth(context);
  assertPermission(context, templatePermissions.create);
  const repository = await resolveRepository(deps);
  const payload = validateTemplateCreateInput(input);
  const record = await repository.create(getTenantId(context), payload);
  return toTemplateView(record) as TemplateView;
}

export async function getTemplate(
  id: string,
  context: TemplateServiceContext | RequestContext,
  deps?: TemplateServiceDeps,
): Promise<TemplateView | null> {
  assertAuth(context);
  assertPermission(context, templatePermissions.read);
  const repository = await resolveRepository(deps);
  return toTemplateView(await repository.getById(getTenantId(context), id));
}

export async function listTemplates(
  context: TemplateServiceContext | RequestContext,
  deps?: TemplateServiceDeps,
  filter?: unknown,
): Promise<TemplateView[]> {
  assertAuth(context);
  assertPermission(context, templatePermissions.read);
  const repository = await resolveRepository(deps);
  return (await repository.list(getTenantId(context), validateTemplateListFilter(filter))).map((record) => toTemplateView(record) as TemplateView);
}

export async function updateTemplate(
  id: string,
  input: unknown,
  context: TemplateServiceContext | RequestContext,
  deps?: TemplateServiceDeps,
): Promise<TemplateView | null> {
  assertAuth(context);
  assertPermission(context, templatePermissions.update);
  const repository = await resolveRepository(deps);
  const updated = await repository.update(getTenantId(context), id, validateTemplateUpdateInput(input));
  return toTemplateView(updated);
}

export async function publishTemplate(
  id: string,
  context: TemplateServiceContext | RequestContext,
  deps?: TemplateServiceDeps,
): Promise<TemplateView | null> {
  assertAuth(context);
  assertPermission(context, templatePermissions.publish);
  const repository = await resolveRepository(deps);
  const tenantId = getTenantId(context);
  const current = await repository.getById(tenantId, id);
  if (!current) return null;
  ensureRequiredSystemKeys(current);
  const published = await repository.publish(tenantId, id);
  if (!published) return null;

  if (published.layout) {
    const competingTemplates = (await repository.list(tenantId, { status: "PUBLISHED" }))
      .filter((template) => template.id !== published.id && template.layout === published.layout);
    await Promise.all(competingTemplates.map((template) => repository.archive(tenantId, template.id)));
  }

  return toTemplateView(published);
}

export async function archiveTemplate(
  id: string,
  context: TemplateServiceContext | RequestContext,
  deps?: TemplateServiceDeps,
): Promise<boolean> {
  assertAuth(context);
  assertPermission(context, templatePermissions.delete);
  const repository = await resolveRepository(deps);
  return Boolean(await repository.archive(getTenantId(context), id));
}
