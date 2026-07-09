import type { AcademicYearRecord, AcademicYearView } from "./academic-years.model";

export function toAcademicYearView(record: AcademicYearRecord | null): AcademicYearView | null {
  return record ? { ...record, createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt), activatedAt: record.activatedAt ? new Date(record.activatedAt) : undefined, deactivatedAt: record.deactivatedAt ? new Date(record.deactivatedAt) : undefined } : null;
}
