import type { ProgramRecord, ProgramView } from "./programs.model";

function iso(value: Date | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

export function toProgramView(record: ProgramRecord | null): ProgramView | null {
  if (!record) return null;
  return {
    id: record.id,
    tenantId: record.tenantId,
    campusId: record.campusId,
    academicUnitId: record.academicUnitId,
    code: record.code,
    name: record.name,
    description: record.description,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deactivatedAt: iso(record.deactivatedAt),
  };
}
