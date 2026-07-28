import type { RequestContext } from "@school-erp/api";
import type { Permission } from "@school-erp/auth";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@school-erp/errors";
import type { StudentEnrolledEventData } from "@school-erp/events";
import {
  feeConfigurationRepository,
  type FeeConfigurationRepository,
} from "../fee-configuration/fee-configuration.repository";
import type {
  FeeMappingRecord,
  FeeScheduleRecord,
  FeeStructureRecord,
} from "../fee-configuration/fee-configuration.model";
import { toFeeOrderView } from "./fee-orders.mapper";
import type {
  FeeOrderCharge,
  FeeOrderFilter,
  GenerateFeeOrderInput,
} from "./fee-orders.model";
import { feeOrderPermissions } from "./fee-orders.permissions";
import {
  feeOrderRepository,
  type FeeOrderRepository,
} from "./fee-orders.repository";
import { validateFeeOrderFilter } from "./fee-orders.validator";

export interface FeeOrderDependencies {
  orders?: FeeOrderRepository | Promise<FeeOrderRepository>;
  configuration?:
    | FeeConfigurationRepository
    | Promise<FeeConfigurationRepository>;
  now?: () => Date;
}

const orders = async (deps?: FeeOrderDependencies) =>
  await (deps?.orders ?? feeOrderRepository());
const configuration = async (deps?: FeeOrderDependencies) =>
  await (deps?.configuration ?? feeConfigurationRepository());
function tenantFromContext(context: RequestContext) {
  const value = context.tenantContext?.tenantId?.trim();
  if (!value) throw new BadRequestError("tenantId is required");
  return value;
}
function requirePermission(context: RequestContext, required: Permission) {
  if (!(context.authContext?.user?.permissions ?? []).includes(required))
    throw new ForbiddenError(`permission ${required} is required`);
}

function selectMapping(
  mappings: FeeMappingRecord[],
  input: GenerateFeeOrderInput,
): FeeMappingRecord {
  const candidates = mappings.filter(
    (mapping) =>
      mapping.status === "ACTIVE" &&
      mapping.campusId === input.campusId &&
      mapping.academicYearId === input.academicYearId &&
      mapping.target.classId === input.classId &&
      (!mapping.target.programId ||
        mapping.target.programId === input.programId) &&
      (!mapping.target.sectionId ||
        mapping.target.sectionId === input.sectionId),
  );
  const ranked = candidates.sort(
    (a, b) =>
      Number(Boolean(b.target.sectionId)) -
        Number(Boolean(a.target.sectionId)) ||
      Number(Boolean(b.target.programId)) - Number(Boolean(a.target.programId)),
  );
  if (!ranked[0])
    throw new NotFoundError(
      "no active fee mapping exists for the enrolled class",
    );
  const topRank = `${Boolean(ranked[0].target.sectionId)}:${Boolean(ranked[0].target.programId)}`;
  if (
    ranked[1] &&
    `${Boolean(ranked[1].target.sectionId)}:${Boolean(ranked[1].target.programId)}` ===
      topRank
  )
    throw new ConflictError(
      "multiple active fee mappings match this enrollment",
    );
  return ranked[0];
}

function buildCharges(
  structure: FeeStructureRecord,
  schedule: FeeScheduleRecord,
  heads: Map<string, { code: string; name: string; refundable: boolean }>,
): FeeOrderCharge[] {
  return structure.components.map((component, index) => {
    const head = heads.get(component.feeHeadId);
    if (!head)
      throw new ConflictError("fee structure references a missing fee head");
    return {
      id: `charge_${crypto.randomUUID()}`,
      feeHeadId: component.feeHeadId,
      feeHeadCode: head.code,
      label: head.name,
      refundable: head.refundable,
      sequence: component.allocationPriority ?? index + 1,
      amountMinor: component.amountMinor,
      paidMinor: 0,
      balanceMinor: component.amountMinor,
    };
  });
}

export async function generateFeeOrderFromEnrollment(
  input: StudentEnrolledEventData,
  tenantId: string,
  deps?: FeeOrderDependencies,
) {
  const payload: GenerateFeeOrderInput = { ...input };
  const orderRepository = await orders(deps);
  const existing = await orderRepository.getByEnrollmentId(
    tenantId,
    payload.enrollmentId,
  );
  if (existing) return toFeeOrderView(existing);
  const annualOrder = await orderRepository.getByStudentAcademicYear(
    tenantId,
    payload.studentId,
    payload.academicYearId,
  );
  if (
    annualOrder &&
    (annualOrder.enrollmentId === payload.enrollmentId ||
      annualOrder.campusId === payload.campusId)
  )
    return toFeeOrderView(annualOrder);
  if (annualOrder && annualOrder.campusId !== payload.campusId) {
    const previousCampusOrders = await orderRepository.list(tenantId, {
      studentId: payload.studentId,
      academicYearId: payload.academicYearId,
    });
    const additionalLiabilities = previousCampusOrders.filter(
      (order) =>
        order.campusId === annualOrder.campusId &&
        (order.sourceType ?? "ANNUAL") !== "ANNUAL" &&
        order.status !== "CANCELLED",
    );
    if (additionalLiabilities.length > 0) {
      throw new ConflictError(
        "campus transfer requires finance review because additional fee liabilities exist in the previous campus",
      );
    }
  }
  if (annualOrder && annualOrder.status !== "CANCELLED") {
    if (annualOrder.paidMinor > 0)
      throw new ConflictError(
        "campus transfer requires finance review because the existing annual fee order has payments",
      );
    const cancelled = await orderRepository.replace(tenantId, {
      ...annualOrder,
      status: "CANCELLED",
      updatedAt: deps?.now?.() ?? new Date(),
    });
    if (!cancelled)
      throw new ConflictError("existing annual fee order could not be cancelled");
  }
  const configRepository = await configuration(deps);
  const snapshot = await configRepository.snapshot(tenantId, {
    campusId: payload.campusId,
    academicYearId: payload.academicYearId,
  });
  const mapping = selectMapping(snapshot.mappings, payload);
  const structure = snapshot.structures.find(
    (item) => item.id === mapping.structureId && item.status === "ACTIVE",
  );
  const schedule = snapshot.schedules.find(
    (item) => item.id === mapping.scheduleId && item.status === "ACTIVE",
  );
  if (!structure || !schedule)
    throw new ConflictError("fee mapping references inactive configuration");
  const heads = new Map(
    snapshot.feeHeads
      .filter((item) => item.status === "ACTIVE")
      .map((item) => [
        item.id,
        { code: item.code, name: item.name, refundable: item.refundable },
      ]),
  );
  const charges = buildCharges(structure, schedule, heads);
  const at = deps?.now?.() ?? new Date();
  const record = await orderRepository.create(tenantId, {
    ...payload,
    sourceType: "ANNUAL",
    sourceId: payload.enrollmentId,
    mappingId: mapping.id,
    structureId: structure.id,
    structureCode: structure.code,
    structureName: structure.name,
    scheduleId: schedule.id,
    scheduleCode: schedule.code,
    scheduleName: schedule.name,
    collectionPolicy: schedule.collectionPolicy ?? "PARTIAL_ALLOWED",
    currency: "INR",
    charges,
    totalMinor: structure.totalAmountMinor,
    paidMinor: 0,
    balanceMinor: structure.totalAmountMinor,
    status: "OPEN",
    createdAt: at,
    updatedAt: at,
  });
  return toFeeOrderView(record);
}

export async function listFeeOrders(
  filter: unknown,
  context: RequestContext,
  deps?: FeeOrderDependencies,
) {
  requirePermission(context, feeOrderPermissions.read as Permission);
  return (
    await (
      await orders(deps)
    ).list(tenantFromContext(context), validateFeeOrderFilter(filter))
  ).map(toFeeOrderView);
}

export async function listFeeOrderPage(filter: unknown, context: RequestContext, deps?: FeeOrderDependencies) {
  requirePermission(context, feeOrderPermissions.read as Permission);
  const page = await (await orders(deps)).listPage(tenantFromContext(context), validateFeeOrderFilter(filter));
  return { ...page, items: page.items.map(toFeeOrderView) };
}

export async function getFeeOrder(
  id: string,
  context: RequestContext,
  deps?: FeeOrderDependencies,
) {
  requirePermission(context, feeOrderPermissions.read as Permission);
  const record = await (
    await orders(deps)
  ).getById(tenantFromContext(context), id.trim());
  if (!record) throw new NotFoundError("fee order was not found");
  return toFeeOrderView(record);
}
