import type { ClassRepository } from "../modules/classes/classes.repository";
import type { ProgramRepository } from "../modules/programs/programs.repository";

export function academicHierarchyFixture(
  options: { campusId?: string; programId?: string; classId?: string } = {},
): { programRepository: ProgramRepository; classRepository: ClassRepository } {
  const campusId = options.campusId ?? "campus_1";
  const programId = options.programId ?? "program_1";
  const classId = options.classId ?? "class_1";
  const timestamp = new Date("2025-01-01T00:00:00.000Z");
  const programRepository = {
    getById: async (_tenantId: string, id: string) => id === programId ? {
      id: programId, tenantId: "tenant_1", campusId, code: "PROG-001", name: "Primary School",
      status: "ACTIVE" as const, createdAt: timestamp, updatedAt: timestamp,
    } : null,
  } as ProgramRepository;
  const classRepository = {
    getById: async (_tenantId: string, id: string) => id === classId ? {
      id: classId, tenantId: "tenant_1", campusId, programId, code: "CLASS-001", name: "Grade 1",
      status: "ACTIVE" as const, createdAt: timestamp, updatedAt: timestamp,
    } : null,
  } as ClassRepository;
  return { programRepository, classRepository };
}
