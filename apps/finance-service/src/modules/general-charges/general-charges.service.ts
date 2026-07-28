import type { RequestContext } from "@school-erp/api";
import type { Permission } from "@school-erp/auth";
import { ConflictError, ForbiddenError, NotFoundError } from "@school-erp/errors";
import { feeConfigurationRepository, type FeeConfigurationRepository } from "../fee-configuration/fee-configuration.repository";
import { feeOrderRepository, type FeeOrderRepository } from "../fee-orders/fee-orders.repository";
import type { FeeOrderRecord } from "../fee-orders/fee-orders.model";
import { toGeneralChargeView } from "./general-charges.mapper";
import { generalChargePermissions } from "./general-charges.permissions";
import { generalChargeRepository, type GeneralChargeRepository } from "./general-charges.repository";
import { validateCreateGeneralCharge, validateGeneralChargeFilter } from "./general-charges.validator";

export interface GeneralChargeDependencies {
  charges?: GeneralChargeRepository | Promise<GeneralChargeRepository>;
  orders?: FeeOrderRepository | Promise<FeeOrderRepository>;
  configuration?: FeeConfigurationRepository | Promise<FeeConfigurationRepository>;
  now?: () => Date;
}
const tenantId = (context: RequestContext) => {
  const value = context.tenantContext?.tenantId?.trim();
  if (!value) throw new ForbiddenError("tenant context is required");
  return value;
};
const actorId = (context: RequestContext) => {
  const value = context.authContext?.user?.id?.trim();
  if (!value) throw new ForbiddenError("authentication is required");
  return value;
};
const permission = (context: RequestContext, required: Permission) => {
  if (!context.authContext?.user?.permissions.includes(required))
    throw new ForbiddenError(`permission ${required} is required`);
};
const charges = async (deps?: GeneralChargeDependencies) => await (deps?.charges ?? generalChargeRepository());
const orders = async (deps?: GeneralChargeDependencies) => await (deps?.orders ?? feeOrderRepository());
const configuration = async (deps?: GeneralChargeDependencies) => await (deps?.configuration ?? feeConfigurationRepository());

function eligibleStudents(annualOrders: FeeOrderRecord[], target: { type: "STUDENT" | "CLASS" | "SECTION"; ids: string[] }) {
  const ids = new Set(target.ids);
  const matched = annualOrders.filter((order) => {
    if ((order.sourceType ?? "ANNUAL") !== "ANNUAL") return false;
    if (target.type === "STUDENT") return ids.has(order.studentId);
    if (target.type === "CLASS") return ids.has(order.classId);
    return Boolean(order.sectionId && ids.has(order.sectionId));
  });
  const unique = new Map<string, FeeOrderRecord>();
  for (const order of matched) if (!unique.has(order.studentId)) unique.set(order.studentId, order);
  if (target.type === "STUDENT") {
    const missing = target.ids.filter((id) => !unique.has(id));
    if (missing.length) throw new NotFoundError(`${missing.length} selected students do not have an annual finance projection`);
  }
  if (!unique.size) throw new NotFoundError("no eligible students were found for the selected target");
  return [...unique.values()];
}

export async function createGeneralCharge(input: unknown, context: RequestContext, deps: GeneralChargeDependencies = {}) {
  permission(context, generalChargePermissions.assign as Permission);
  const tenant = tenantId(context);
  const value = validateCreateGeneralCharge(input);
  const snapshot = await (await configuration(deps)).snapshot(tenant, { campusId: value.campusId, academicYearId: value.academicYearId });
  const feeHead = snapshot.feeHeads.find((item) => item.id === value.feeHeadId && item.status === "ACTIVE");
  if (!feeHead) throw new NotFoundError("active fee head was not found in this finance scope");
  const repository = await charges(deps);
  let assignment = await repository.reserve(tenant, actorId(context), feeHead.code, value);
  if (assignment.status === "ASSIGNED") return toGeneralChargeView(assignment);
  const orderRepository = await orders(deps);
  try {
    const annualOrders = await orderRepository.list(tenant, { campusId: value.campusId, academicYearId: value.academicYearId, sourceType: "ANNUAL" });
    const students = eligibleStudents(annualOrders, value.target);
    let assignedCount = 0;
    for (const student of students) {
      const now = deps.now?.() ?? new Date();
      await orderRepository.create(tenant, {
        sourceType: "GENERAL",
        sourceId: assignment.id,
        ...(assignment.note ? { note: assignment.note } : {}),
        admissionApplicationId: student.admissionApplicationId,
        studentId: student.studentId,
        studentName: student.studentName,
        registrationNumber: student.registrationNumber,
        enrollmentId: `general:${assignment.id}:${student.studentId}`,
        campusId: student.campusId,
        academicYearId: student.academicYearId,
        programId: student.programId,
        classId: student.classId,
        ...(student.sectionId ? { sectionId: student.sectionId } : {}),
        mappingId: assignment.id,
        structureId: assignment.id,
        structureCode: feeHead.code,
        structureName: assignment.name,
        scheduleId: assignment.id,
        scheduleCode: "GENERAL",
        scheduleName: "General charge",
        collectionPolicy: assignment.collectionPolicy,
        currency: "INR",
        charges: [{
          id: `charge_${crypto.randomUUID()}`,
          feeHeadId: feeHead.id,
          feeHeadCode: feeHead.code,
          label: feeHead.name,
          refundable: feeHead.refundable,
          sequence: 1,
          amountMinor: assignment.amountMinor,
          paidMinor: 0,
          balanceMinor: assignment.amountMinor,
        }],
        totalMinor: assignment.amountMinor,
        paidMinor: 0,
        balanceMinor: assignment.amountMinor,
        status: "OPEN",
        createdBy: actorId(context),
        createdAt: now,
        updatedAt: now,
      });
      assignedCount += 1;
    }
    const successfulAssignment = { ...assignment };
    delete successfulAssignment.failureReason;
    assignment = await repository.update(tenant, { ...successfulAssignment, status: "ASSIGNED", assignedCount, updatedAt: deps.now?.() ?? new Date() });
    return toGeneralChargeView(assignment);
  } catch (error) {
    await repository.update(tenant, { ...assignment, status: "FAILED", failureReason: error instanceof Error ? error.message : "general charge assignment failed", updatedAt: deps.now?.() ?? new Date() });
    if (error instanceof NotFoundError || error instanceof ConflictError) throw error;
    throw new ConflictError("general charge assignment failed", { cause: error });
  }
}

export async function listGeneralCharges(filter: unknown, context: RequestContext, deps: GeneralChargeDependencies = {}) {
  permission(context, generalChargePermissions.read as Permission);
  return (await (await charges(deps)).list(tenantId(context), validateGeneralChargeFilter(filter))).map(toGeneralChargeView);
}
