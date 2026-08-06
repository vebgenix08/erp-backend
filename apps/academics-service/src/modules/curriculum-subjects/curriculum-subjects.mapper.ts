import type { CurriculumSubjectRecord } from "./curriculum-subjects.model";
export const toCurriculumSubjectView = (record: CurriculumSubjectRecord) => ({
  ...record, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(), deactivatedAt: record.deactivatedAt?.toISOString(),
});
