import type { CampusRecord, CampusView } from "./campuses.model";

export function toCampusView(record: CampusRecord | null): CampusView | null {
  return record ? { ...record, createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt) } : null;
}
