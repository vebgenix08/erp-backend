import { BadRequestError, NotFoundError } from "@school-erp/errors";
import type { ClassRepository } from "./classes/classes.repository";
import { classRepository } from "./classes/classes.repository";
import type { ProgramRepository } from "./programs/programs.repository";
import { programRepository } from "./programs/programs.repository";

export interface AcademicHierarchyRepositories {
  programRepository?: ProgramRepository | Promise<ProgramRepository>;
  classRepository?: ClassRepository | Promise<ClassRepository>;
}

async function programs(deps?: AcademicHierarchyRepositories) {
  return await (deps?.programRepository ?? programRepository);
}

async function classes(deps?: AcademicHierarchyRepositories) {
  return await (deps?.classRepository ?? classRepository);
}

export async function requireProgramInCampus(
  tenantId: string,
  campusId: string,
  programId: string,
  deps?: AcademicHierarchyRepositories,
) {
  const program = await (await programs(deps)).getById(tenantId, programId);
  if (!program || program.status !== "ACTIVE") throw new NotFoundError("active program not found");
  if (program.campusId !== campusId) throw new BadRequestError("program does not belong to the selected campus");
  return program;
}

export async function requireClassInHierarchy(
  tenantId: string,
  campusId: string,
  programId: string,
  classId: string,
  deps?: AcademicHierarchyRepositories,
) {
  await requireProgramInCampus(tenantId, campusId, programId, deps);
  const academicClass = await (await classes(deps)).getById(tenantId, classId);
  if (!academicClass || academicClass.status !== "ACTIVE") throw new NotFoundError("active class not found");
  if (academicClass.campusId !== campusId) throw new BadRequestError("class does not belong to the selected campus");
  if (academicClass.programId !== programId) throw new BadRequestError("class does not belong to the selected program");
  return academicClass;
}
