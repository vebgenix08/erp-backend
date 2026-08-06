import type { CurriculumRecord, CurriculumView } from "./curricula.model";

export function toCurriculumView(record: CurriculumRecord): CurriculumView {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deactivatedAt: record.deactivatedAt?.toISOString(),
  };
}
