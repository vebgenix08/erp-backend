import type { RequestContext } from "@school-erp/api";
import type { Permission } from "@school-erp/auth";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "@school-erp/errors";
import type { StudentEnrolledEventData } from "@school-erp/events";
import { generateFeeOrderFromEnrollment } from "../fee-orders/fee-orders.service";
import { toFeeOrderRecoveryView } from "./fee-order-recovery.mapper";
import { feeOrderRecoveryPermissions } from "./fee-order-recovery.permissions";
import {
  feeOrderRecoveryRepository,
  type FeeOrderRecoveryRepository,
} from "./fee-order-recovery.repository";
import { validateFeeOrderRecoveryFilter } from "./fee-order-recovery.validator";
export interface FeeOrderRecoveryDependencies {
  repository?: FeeOrderRecoveryRepository | Promise<FeeOrderRecoveryRepository>;
  generate?: (
    payload: StudentEnrolledEventData,
    tenantId: string,
  ) => Promise<unknown>;
  now?: () => Date;
}
const repository = async (deps?: FeeOrderRecoveryDependencies) =>
  await (deps?.repository ?? feeOrderRecoveryRepository());
const tenantId = (context: RequestContext) => {
  const value = context.tenantContext?.tenantId?.trim();
  if (!value) throw new BadRequestError("tenantId is required");
  return value;
};
const actorId = (context: RequestContext) => {
  const value = context.authContext?.user?.id?.trim();
  if (!value) throw new ForbiddenError("authenticated user is required");
  return value;
};
const permission = (context: RequestContext, required: Permission) => {
  if (!(context.authContext?.user?.permissions ?? []).includes(required))
    throw new ForbiddenError(`permission ${required} is required`);
};
export async function recordFeeOrderFailure(
  tenantId: string,
  eventId: string,
  payload: StudentEnrolledEventData,
  error: unknown,
  deps: FeeOrderRecoveryDependencies = {},
) {
  const message =
    error instanceof Error ? error.message : "fee order generation failed";
  return (await repository(deps)).recordFailure(
    tenantId,
    eventId,
    payload,
    message,
    deps.now?.() ?? new Date(),
  );
}
export async function resolveFeeOrderRecoveryForEvent(
  tenantId: string,
  eventId: string,
  actorId: string,
  deps: FeeOrderRecoveryDependencies = {},
) {
  const store = await repository(deps),
    records = await store.list(tenantId, { status: "PENDING" });
  const record = records.find((item) => item.eventId === eventId);
  return record
    ? store.resolve(tenantId, record.id, actorId, deps.now?.() ?? new Date())
    : null;
}
export async function listFeeOrderRecoveries(
  filter: unknown,
  context: RequestContext,
  deps: FeeOrderRecoveryDependencies = {},
) {
  permission(context, feeOrderRecoveryPermissions.read as Permission);
  return (
    await (
      await repository(deps)
    ).list(tenantId(context), validateFeeOrderRecoveryFilter(filter))
  ).map(toFeeOrderRecoveryView);
}
export async function retryFeeOrderRecovery(
  id: string,
  context: RequestContext,
  deps: FeeOrderRecoveryDependencies = {},
) {
  permission(context, feeOrderRecoveryPermissions.retry as Permission);
  const tenant = tenantId(context),
    store = await repository(deps),
    record = await store.getById(tenant, id.trim());
  if (!record) throw new NotFoundError("fee order recovery was not found");
  if (record.status === "RESOLVED") return toFeeOrderRecoveryView(record);
  try {
    await (deps.generate ?? generateFeeOrderFromEnrollment)(
      record.payload,
      tenant,
    );
    const resolved = await store.resolve(
      tenant,
      record.id,
      actorId(context),
      deps.now?.() ?? new Date(),
    );
    if (!resolved) throw new NotFoundError("fee order recovery was not found");
    return toFeeOrderRecoveryView(resolved);
  } catch (error) {
    await store.recordFailure(
      tenant,
      record.eventId,
      record.payload,
      error instanceof Error ? error.message : "fee order retry failed",
      deps.now?.() ?? new Date(),
    );
    throw error;
  }
}
