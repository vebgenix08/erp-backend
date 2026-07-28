import type { ClassRecord, ClassView } from "./classes.model";

function iso(value: Date | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

export function toClassView(record: ClassRecord | null): ClassView | null {
  if (!record) return null;
  return {
    id: record.id,
    tenantId: record.tenantId,
    campusId: record.campusId,
    programId: record.programId,
    code: record.code,
    name: record.name,
    description: record.description,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deactivatedAt: iso(record.deactivatedAt),
  };
}
