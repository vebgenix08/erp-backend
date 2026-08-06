import type { AcademicOfferingRecord, AcademicOfferingView } from "./academic-offerings.model";
export const toAcademicOfferingView = (record: AcademicOfferingRecord): AcademicOfferingView => ({
  ...record,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
  deactivatedAt: record.deactivatedAt?.toISOString(),
});
