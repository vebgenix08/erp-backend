import type { FeeOrderRecoveryRecord } from "./fee-order-recovery.model";
export const toFeeOrderRecoveryView = (record: FeeOrderRecoveryRecord) => ({
  ...record,
  payload: { ...record.payload },
  lastAttemptAt: record.lastAttemptAt.toISOString(),
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
  ...(record.resolvedAt ? { resolvedAt: record.resolvedAt.toISOString() } : {}),
});
