import type { SubjectCatalogueRecord } from "./subject-catalogue.model";

export function toSubjectCatalogueView(record: SubjectCatalogueRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deactivatedAt: record.deactivatedAt?.toISOString(),
  };
}
