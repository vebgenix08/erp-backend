import type { SectionRecord, SectionView } from "./sections.model";

function iso(value: Date | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

export function toSectionView(record: SectionRecord | null): SectionView | null {
  if (!record) return null;
  return {
    id: record.id,
    tenantId: record.tenantId,
    campusId: record.campusId,
    programId: record.programId,
    classId: record.classId,
    code: record.code,
    name: record.name,
    description: record.description,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deactivatedAt: iso(record.deactivatedAt),
  };
}
