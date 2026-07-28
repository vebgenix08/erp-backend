import { BadRequestError, ConflictError } from "@school-erp/errors";
import { requireAuth, requirePermission } from "@school-erp/auth";
import { requireTenantId } from "@school-erp/tenancy";
import type { StructuredLogger } from "@school-erp/logger";
import { enquiryPermissions } from "./enquiry.permissions";
import { toEnquiryView } from "./enquiry.mapper";
import { enquiryRepository as defaultRepository, type EnquiryRepository } from "./enquiry.repository";
import { validateEnquiryCreateInput, validateEnquiryListFilter, validateEnquiryUpdateInput } from "./enquiry.validator";
import type { EnquiryListFilter, EnquiryServiceContext, EnquiryView } from "./enquiry.model";

export interface AdmissionsServiceDeps {
  repository?: EnquiryRepository | undefined;
  logger?: StructuredLogger | undefined;
}

function resolveRepository(deps?: AdmissionsServiceDeps): EnquiryRepository {
  return deps?.repository ?? defaultRepository;
}

function resolveLogger(deps?: AdmissionsServiceDeps): StructuredLogger | undefined {
  return deps?.logger;
}

function getTenantId(context: EnquiryServiceContext): string {
  return requireTenantId(context.tenantContext);
}

function getActorId(context: EnquiryServiceContext): string {
  const auth = requireAuth(context.authContext);
  const userId = auth.user?.id?.trim();
  if (!userId) {
    throw new BadRequestError("authenticated user id is required");
  }
  return userId;
}

function assertPermission(context: EnquiryServiceContext, permission: string): void {
  requirePermission(context.authContext, permission);
}

function log(deps: AdmissionsServiceDeps | undefined, message: string, context: EnquiryServiceContext): void {
  const logger = resolveLogger(deps);
  if (!logger) return;
  logger.withContext({
    requestId: context.requestId,
    tenantId: context.tenantContext.tenantId,
    userId: context.authContext.user?.id,
  }).info(message);
}

function formatEnquiryNumber(sequence: number): string {
  return `ENQ-${String(sequence).padStart(4, "0")}`;
}

export async function createEnquiry(
  input: unknown,
  context: EnquiryServiceContext,
  deps?: AdmissionsServiceDeps,
): Promise<EnquiryView> {
  assertPermission(context, enquiryPermissions.create);
  const repository = resolveRepository(deps);
  const tenantId = getTenantId(context);
  const payload = validateEnquiryCreateInput(input);
  const sequence = await repository.nextEnquirySequence(tenantId);
  const enquiryNumber = formatEnquiryNumber(sequence);
  const now = new Date();
  const createdBy = getActorId(context);
  const record = await repository.create(tenantId, {
    ...payload,
    enquiryNumber,
    createdBy,
    status: "NEW",
    createdAt: now,
    updatedAt: now,
  });
  log(deps, `enquiry.created:${record.enquiryNumber}`, context);
  return toEnquiryView(record) as EnquiryView;
}

export async function getEnquiry(
  id: string,
  context: EnquiryServiceContext,
  deps?: AdmissionsServiceDeps,
): Promise<EnquiryView | null> {
  assertPermission(context, enquiryPermissions.read);
  const repository = resolveRepository(deps);
  const tenantId = getTenantId(context);
  const enquiry = await repository.getById(tenantId, id);
  return toEnquiryView(enquiry);
}

export async function listEnquiries(
  context: EnquiryServiceContext,
  deps?: AdmissionsServiceDeps,
  filter?: EnquiryListFilter,
): Promise<EnquiryView[]> {
  assertPermission(context, enquiryPermissions.read);
  const repository = resolveRepository(deps);
  const tenantId = getTenantId(context);
  const enquiries = await repository.list(tenantId, validateEnquiryListFilter(filter));
  return enquiries.map((enquiry) => toEnquiryView(enquiry) as EnquiryView);
}

export async function listEnquiryPage(context: EnquiryServiceContext, deps?: AdmissionsServiceDeps, filter?: EnquiryListFilter) {
  assertPermission(context, enquiryPermissions.read);
  const page = await resolveRepository(deps).listPage(getTenantId(context), validateEnquiryListFilter(filter));
  return { ...page, items: page.items.map((enquiry) => toEnquiryView(enquiry) as EnquiryView) };
}

export async function updateEnquiry(
  id: string,
  input: unknown,
  context: EnquiryServiceContext,
  deps?: AdmissionsServiceDeps,
): Promise<EnquiryView | null> {
  assertPermission(context, enquiryPermissions.update);
  const repository = resolveRepository(deps);
  const tenantId = getTenantId(context);
  const existing = await repository.getById(tenantId, id);
  if (!existing) {
    return null;
  }
  if (existing.status === "CLOSED") {
    throw new ConflictError("closed enquiries cannot be updated");
  }
  const payload = validateEnquiryUpdateInput(input);
  const updated = await repository.update(tenantId, id, {
    ...payload,
    updatedAt: new Date(),
  });
  log(deps, `enquiry.updated:${existing.enquiryNumber}`, context);
  return toEnquiryView(updated);
}

export async function closeEnquiry(
  id: string,
  context: EnquiryServiceContext,
  deps?: AdmissionsServiceDeps,
): Promise<EnquiryView | null> {
  assertPermission(context, enquiryPermissions.close);
  const repository = resolveRepository(deps);
  const tenantId = getTenantId(context);
  const existing = await repository.getById(tenantId, id);
  if (!existing) {
    return null;
  }
  if (existing.status === "CLOSED") {
    return toEnquiryView(existing);
  }
  const now = new Date();
  const closed = await repository.close(tenantId, id, {
    status: "CLOSED",
    closedAt: now,
    updatedAt: now,
  });
  log(deps, `enquiry.closed:${existing.enquiryNumber}`, context);
  return toEnquiryView(closed);
}
