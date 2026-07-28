import type { FeeOrderRecord } from "./fee-orders.model";

export function toFeeOrderView(record: FeeOrderRecord) {
  return {
    ...record,
    collectionPolicy: record.collectionPolicy ?? "PARTIAL_ALLOWED",
    charges: record.charges.map((charge) => ({
      ...charge,
      refundable: charge.refundable ?? false,
    })),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
