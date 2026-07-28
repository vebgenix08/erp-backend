import type { SubjectRecord, SubjectView } from "./subjects.model";

function iso(value: Date | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

export function toSubjectView(record: SubjectRecord | null): SubjectView | null {
  if (!record) return null;
  return {
    id: record.id,
    tenantId: record.tenantId,
    campusId: record.campusId,
    programId: record.programId,
    classId: record.classId,
    code: record.code,
    name: record.name,
    subjectType: record.subjectType,
    credits: record.credits,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deactivatedAt: iso(record.deactivatedAt),
  };
}
