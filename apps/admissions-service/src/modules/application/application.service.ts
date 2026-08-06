import { requireAuth, requirePermission } from "@school-erp/auth";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@school-erp/errors";
import type {
  AdmissionConfirmedEvent,
  AdmissionConfirmedEventData,
  EventPublisher,
} from "@school-erp/events";
import type { StructuredLogger } from "@school-erp/logger";
import { issueConfiguredNumber, type NumberingContext, type NumberingStream } from "@school-erp/numbering";
import { requireTenantId } from "@school-erp/tenancy";
import { toApplicationView } from "./application.mapper";
import type {
  ApplicationDuplicateCheck,
  ApplicationDuplicateReason,
  ApplicationListFilter,
  ApplicationRecord,
  ApplicationServiceContext,
  ApplicationStatus,
  ApplicationView,
} from "./application.model";
import { applicationPermissions } from "./application.permissions";
import {
  applicationRepository,
  type ApplicationRepository,
} from "./application.repository";
import {
  academicYearReferenceReader,
  normalizeAcademicYearCode,
  type AcademicYearReferenceReader,
} from "./academic-year-reference.repository";
import {
  validateAdmissionConfirmationInput,
  validateApplicationCreateInput,
  validateApplicationListFilter,
  validateApplicationUpdateInput,
  validateRejectInput,
  validateReviewInput,
} from "./application.validator";

export interface ApplicationServiceDeps {
  repository?: ApplicationRepository | undefined;
  academicYears?:
    | AcademicYearReferenceReader
    | Promise<AcademicYearReferenceReader>
    | undefined;
  logger?: StructuredLogger | undefined;
  now?: (() => Date) | undefined;
  eventPublisher?: EventPublisher | undefined;
  numberIssuer?: ((context: NumberingContext) => Promise<string>) | undefined;
}
function repo(deps?: ApplicationServiceDeps) {
  return deps?.repository ?? applicationRepository;
}
function now(deps?: ApplicationServiceDeps) {
  return deps?.now?.() ?? new Date();
}
function tenantId(context: ApplicationServiceContext) {
  return requireTenantId(context.tenantContext);
}
function actorId(context: ApplicationServiceContext) {
  const auth = requireAuth(context.authContext);
  const id = auth.user?.id?.trim();
  if (!id) throw new BadRequestError("authenticated user id is required");
  return id;
}
function permission(context: ApplicationServiceContext, value: string) {
  requirePermission(context.authContext, value);
}
async function configuredNumber(
  stream: Extract<NumberingStream, "APPLICATION" | "ADMISSION">,
  record: ApplicationRecord,
  tenant: string,
  deps?: ApplicationServiceDeps,
) {
  const context: NumberingContext = {
    tenantId: tenant,
    stream,
    idempotencyKey: record.id,
    academicYearId: record.academicYearId,
    ...(record.campusId ? { campusId: record.campusId } : {}),
  };
  if (deps?.numberIssuer) return deps.numberIssuer(context);
  if (!deps?.repository) return issueConfiguredNumber(context);
  const code = await resolveAcademicYearCode(record, deps);
  const sequence = stream === "APPLICATION"
    ? await deps.repository.nextApplicationSequence(tenant, record.academicYearId)
    : await deps.repository.nextAdmissionSequence(tenant, record.academicYearId);
  return `${stream === "APPLICATION" ? "APP" : "ADM"}/${code}/${String(sequence).padStart(4, "0")}`;
}
function log(
  deps: ApplicationServiceDeps | undefined,
  context: ApplicationServiceContext,
  message: string,
) {
  deps?.logger
    ?.withContext({
      requestId: context.requestId,
      tenantId: context.tenantContext.tenantId,
      userId: context.authContext.user?.id,
    })
    .info(message);
}
function view(record: ApplicationRecord | null): ApplicationView {
  const mapped = toApplicationView(record);
  if (!mapped) throw new NotFoundError("application not found");
  return mapped;
}
function persisted(record: ApplicationRecord | null): ApplicationRecord {
  if (!record)
    throw new ConflictError(
      "application changed before the operation completed",
    );
  return record;
}
function stage(
  record: ApplicationRecord,
  status: ApplicationStatus,
  at: Date,
  actor: string,
  remarks?: string,
): ApplicationRecord {
  return {
    ...record,
    status,
    updatedAt: at,
    stageHistory: [
      ...record.stageHistory,
      { status, at, actorId: actor, remarks },
    ],
  };
}
async function resolveAcademicYearCode(
  record: ApplicationRecord,
  deps?: ApplicationServiceDeps,
) {
  if (record.academicYearCode) return record.academicYearCode;
  if (/^\d{2,4}\D+\d{2,4}$/.test(record.academicYearId))
    return normalizeAcademicYearCode(record.academicYearId);
  const reader = await (deps?.academicYears ?? academicYearReferenceReader());
  return reader.getCode(record.tenantId, record.academicYearId);
}

export async function createApplication(
  input: unknown,
  context: ApplicationServiceContext,
  deps?: ApplicationServiceDeps,
): Promise<ApplicationView> {
  permission(context, applicationPermissions.create);
  const repository = repo(deps),
    tenant = tenantId(context),
    actor = actorId(context),
    payload = validateApplicationCreateInput(input);
  if (
    payload.enquiryId &&
    (await repository.getByEnquiryId(tenant, payload.enquiryId))
  )
    throw new ConflictError(
      "an active application already exists for this enquiry",
    );
  const at = now(deps),
    record = await repository.create(tenant, {
      ...payload,
      id: `application_${crypto.randomUUID()}`,
      status: "DRAFT",
      createdBy: actor,
      createdAt: at,
      updatedAt: at,
      reviews: [],
      stageHistory: [{ status: "DRAFT", at, actorId: actor }],
      pendingEvents: [],
    });
  log(deps, context, `application.created:${record.id}`);
  return view(record);
}
export async function listApplications(
  context: ApplicationServiceContext,
  deps?: ApplicationServiceDeps,
  filter?: ApplicationListFilter,
): Promise<ApplicationView[]> {
  permission(context, applicationPermissions.read);
  return (
    await repo(deps).list(
      tenantId(context),
      validateApplicationListFilter(filter),
    )
  ).map((item) => view(item));
}
export async function listApplicationPage(
  context: ApplicationServiceContext,
  deps?: ApplicationServiceDeps,
  filter?: ApplicationListFilter,
) {
  permission(context, applicationPermissions.read);
  const result = await repo(deps).listPage(
    tenantId(context),
    validateApplicationListFilter(filter),
  );
  return { ...result, items: result.items.map((item) => view(item)) };
}
export async function getApplication(
  id: string,
  context: ApplicationServiceContext,
  deps?: ApplicationServiceDeps,
): Promise<ApplicationView> {
  permission(context, applicationPermissions.read);
  return view(await repo(deps).getById(tenantId(context), id));
}
export async function updateApplication(
  id: string,
  input: unknown,
  context: ApplicationServiceContext,
  deps?: ApplicationServiceDeps,
): Promise<ApplicationView> {
  permission(context, applicationPermissions.update);
  const repository = repo(deps),
    tenant = tenantId(context),
    existing = await repository.getById(tenant, id);
  if (!existing) throw new NotFoundError("application not found");
  if (existing.status !== "DRAFT")
    throw new ConflictError("only draft applications can be edited");
  const updated = {
    ...existing,
    ...validateApplicationUpdateInput(input),
    id: existing.id,
    tenantId: existing.tenantId,
    status: existing.status,
    applicationNumber: existing.applicationNumber,
    createdAt: existing.createdAt,
    createdBy: existing.createdBy,
    updatedAt: now(deps),
  };
  log(deps, context, `application.updated:${id}`);
  return view(await repository.replace(tenant, updated));
}
export async function submitApplication(
  id: string,
  context: ApplicationServiceContext,
  deps?: ApplicationServiceDeps,
): Promise<ApplicationView> {
  permission(context, applicationPermissions.update);
  const repository = repo(deps),
    tenant = tenantId(context),
    actor = actorId(context),
    existing = await repository.getById(tenant, id);
  if (!existing) throw new NotFoundError("application not found");
  if (existing.status !== "DRAFT")
    throw new ConflictError("only draft applications can be submitted");
  const academicYearCode = await resolveAcademicYearCode(existing, deps),
    generatedApplicationNumber = await configuredNumber("APPLICATION", existing, tenant, deps),
    at = now(deps),
    submitted = stage(
      {
        ...existing,
        academicYearCode,
        applicationNumber: generatedApplicationNumber,
        submittedAt: at,
      },
      "SUBMITTED",
      at,
      actor,
    );
  log(deps, context, `application.submitted:${submitted.applicationNumber}`);
  return view(await repository.replace(tenant, submitted));
}
export async function approveApplication(
  id: string,
  input: unknown,
  context: ApplicationServiceContext,
  deps?: ApplicationServiceDeps,
): Promise<ApplicationView> {
  return review(id, "APPROVED", input, context, deps);
}
export async function rejectApplication(
  id: string,
  input: unknown,
  context: ApplicationServiceContext,
  deps?: ApplicationServiceDeps,
): Promise<ApplicationView> {
  return review(id, "REJECTED", input, context, deps);
}
async function review(
  id: string,
  decision: "APPROVED" | "REJECTED",
  input: unknown,
  context: ApplicationServiceContext,
  deps?: ApplicationServiceDeps,
): Promise<ApplicationView> {
  permission(context, applicationPermissions.review);
  const repository = repo(deps),
    tenant = tenantId(context),
    actor = actorId(context),
    existing = await repository.getById(tenant, id);
  if (!existing) throw new NotFoundError("application not found");
  if (existing.status !== "SUBMITTED")
    throw new ConflictError("only submitted applications can be reviewed");
  const remarks =
      decision === "REJECTED"
        ? validateRejectInput(input).reason
        : validateReviewInput(input).remarks,
    at = now(deps),
    reviewed = stage(
      {
        ...existing,
        reviews: [
          ...existing.reviews,
          { decision, reviewedBy: actor, reviewedAt: at, remarks },
        ],
        ...(decision === "APPROVED"
          ? { approvedAt: at, approvedBy: actor }
          : { rejectedAt: at, rejectedBy: actor, rejectionReason: remarks }),
      },
      decision,
      at,
      actor,
      remarks,
    );
  log(
    deps,
    context,
    `application.${decision.toLowerCase()}:${existing.applicationNumber}`,
  );
  return view(await repository.replace(tenant, reviewed));
}
export async function cancelApplication(
  id: string,
  input: unknown,
  context: ApplicationServiceContext,
  deps?: ApplicationServiceDeps,
): Promise<ApplicationView> {
  permission(context, applicationPermissions.update);
  const repository = repo(deps),
    tenant = tenantId(context),
    actor = actorId(context),
    existing = await repository.getById(tenant, id);
  if (!existing) throw new NotFoundError("application not found");
  if (!["DRAFT", "SUBMITTED", "REJECTED"].includes(existing.status))
    throw new ConflictError(
      "application cannot be cancelled in its current status",
    );
  const reason = validateRejectInput(input).reason,
    at = now(deps),
    cancelled = stage(
      {
        ...existing,
        cancelledAt: at,
        cancelledBy: actor,
        cancellationReason: reason,
      },
      "CANCELLED",
      at,
      actor,
      reason,
    );
  return view(await repository.replace(tenant, cancelled));
}

function duplicateReasons(
  source: ApplicationRecord,
  candidate: ApplicationRecord,
): ApplicationDuplicateReason[] {
  const reasons: ApplicationDuplicateReason[] = [];
  const sourceDigits = source.phone.replace(/\D/g, "");
  const candidateDigits = candidate.phone.replace(/\D/g, "");
  const sourcePhone =
    sourceDigits.length > 10 ? sourceDigits.slice(-10) : sourceDigits;
  const candidatePhone =
    candidateDigits.length > 10 ? candidateDigits.slice(-10) : candidateDigits;
  if (sourcePhone && candidatePhone === sourcePhone) reasons.push("PHONE");
  if (
    source.email?.trim() &&
    candidate.email?.trim().toLowerCase() === source.email.trim().toLowerCase()
  )
    reasons.push("EMAIL");
  if (
    source.dateOfBirth &&
    candidate.dateOfBirth &&
    source.studentName.trim().toLowerCase() ===
      candidate.studentName.trim().toLowerCase() &&
    source.dateOfBirth.toISOString().slice(0, 10) ===
      candidate.dateOfBirth.toISOString().slice(0, 10)
  )
    reasons.push("NAME_AND_DATE_OF_BIRTH");
  return reasons;
}

export async function checkApplicationDuplicates(
  id: string,
  context: ApplicationServiceContext,
  deps?: ApplicationServiceDeps,
): Promise<ApplicationDuplicateCheck> {
  permission(context, applicationPermissions.read);
  const repository = repo(deps);
  const tenant = tenantId(context);
  const source = await repository.getById(tenant, id);
  if (!source) throw new NotFoundError("application not found");
  const candidates = await repository.findPotentialDuplicates(tenant, id);
  const matches = candidates
    .map((candidate) => ({
      applicationId: candidate.id,
      ...(candidate.applicationNumber
        ? { applicationNumber: candidate.applicationNumber }
        : {}),
      ...(candidate.admissionNumber
        ? { admissionNumber: candidate.admissionNumber }
        : {}),
      studentName: candidate.studentName,
      status: candidate.status,
      reasons: duplicateReasons(source, candidate),
    }))
    .filter((candidate) => candidate.reasons.length > 0);
  return {
    applicationId: source.id,
    hasPotentialDuplicates: matches.length > 0,
    matches,
    checkedAt: now(deps).toISOString(),
  };
}

export async function confirmApplication(
  id: string,
  input: unknown,
  context: ApplicationServiceContext,
  deps?: ApplicationServiceDeps,
): Promise<ApplicationView> {
  permission(context, applicationPermissions.confirm);
  const repository = repo(deps);
  const tenant = tenantId(context);
  const actor = actorId(context);
  let existing = await repository.getById(tenant, id);
  if (!existing) throw new NotFoundError("application not found");
  if (existing.status !== "APPROVED" && existing.status !== "CONFIRMED") {
    throw new ConflictError("only approved applications can be confirmed");
  }

  const confirmation = validateAdmissionConfirmationInput(input);
  if (existing.status === "APPROVED") {
    const duplicateCheck = await checkApplicationDuplicates(id, context, deps);
    if (
      duplicateCheck.hasPotentialDuplicates &&
      !confirmation.duplicateReviewAcknowledged
    )
      throw new ConflictError(
        "potential duplicate records must be reviewed before confirmation",
      );
  }

  if (existing.status === "APPROVED") {
    const at = now(deps);
    const admissionNumber = await configuredNumber("ADMISSION", existing, tenant, deps);
    const data: AdmissionConfirmedEventData = {
      admissionApplicationId: existing.id,
      admissionNumber,
      campusId: existing.campusId,
      academicYearId: existing.academicYearId,
      classId: existing.academicTargetId,
      studentName: existing.studentName,
      phone: existing.phone,
      parentName: existing.parentName,
      confirmedBy: actor,
      confirmedAt: at.toISOString(),
      ...(existing.sectionId ? { sectionId: existing.sectionId } : {}),
      ...(existing.dateOfBirth
        ? { dateOfBirth: existing.dateOfBirth.toISOString() }
        : {}),
      ...(existing.gender ? { gender: existing.gender } : {}),
      ...(existing.email ? { email: existing.email } : {}),
      ...(existing.address ? { address: existing.address } : {}),
      ...(existing.parentPhone ? { parentPhone: existing.parentPhone } : {}),
      ...(existing.parentRelation
        ? { parentRelation: existing.parentRelation }
        : {}),
    };
    const event: AdmissionConfirmedEvent = {
      id: `event_${crypto.randomUUID()}`,
      type: "admissions.admission.confirmed.v1",
      source: "erp.admissions",
      tenantId: tenant,
      occurredAt: at.toISOString(),
      ...(context.requestId ? { correlationId: context.requestId } : {}),
      data,
    };
    existing = persisted(
      await repository.replace(
        tenant,
        stage(
          {
            ...existing,
            admissionNumber,
            confirmedAt: at,
            confirmedBy: actor,
            pendingEvents: [...existing.pendingEvents, event],
          },
          "CONFIRMED",
          at,
          actor,
        ),
      ),
    );
  }

  if (existing.pendingEvents.length && deps?.eventPublisher) {
    for (const event of existing.pendingEvents)
      await deps.eventPublisher.publish(event);
    existing = persisted(
      await repository.replace(tenant, {
        ...existing,
        pendingEvents: [],
        updatedAt: now(deps),
      }),
    );
  }
  log(deps, context, `application.confirmed:${existing.admissionNumber}`);
  return view(existing);
}
