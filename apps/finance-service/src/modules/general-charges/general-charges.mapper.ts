import type { GeneralChargeRecord } from "./general-charges.model";

export function toGeneralChargeView(record: GeneralChargeRecord) {
  return {
    ...record,
    target: { ...record.target, ids: [...record.target.ids] },
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
