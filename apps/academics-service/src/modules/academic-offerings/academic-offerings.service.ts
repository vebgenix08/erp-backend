import type { RequestContext } from "@school-erp/api";
import type { Permission } from "@school-erp/auth";
import { BadRequestError, NotFoundError } from "@school-erp/errors";
import { classRepository, type ClassRepository } from "../classes/classes.repository";
import { curriculumRepository, type CurriculumRepository } from "../curricula/curricula.repository";
import { programRepository, type ProgramRepository } from "../programs/programs.repository";
import { sectionRepository, type SectionRepository } from "../sections/sections.repository";
import { toAcademicOfferingView } from "./academic-offerings.mapper";
import { academicOfferingPermissions } from "./academic-offerings.permissions";
import { academicOfferingRepository, type AcademicOfferingRepository } from "./academic-offerings.repository";
import { validateAcademicOfferingCreateInput, validateAcademicOfferingListFilter, validateAcademicOfferingUpdateInput } from "./academic-offerings.validator";

export interface SettingsReferenceResolver {
  campusExists(tenantId: string, campusId: string): Promise<boolean>;
  academicYearExists(tenantId: string, academicYearId: string): Promise<boolean>;
}
export interface AcademicOfferingServiceDeps {
  repository?: AcademicOfferingRepository | Promise<AcademicOfferingRepository>;
  curricula?: CurriculumRepository | Promise<CurriculumRepository>;
  programs?: ProgramRepository | Promise<ProgramRepository>;
  classes?: ClassRepository | Promise<ClassRepository>;
  sections?: SectionRepository | Promise<SectionRepository>;
  settings?: SettingsReferenceResolver;
}
const tenantId = (context: RequestContext) => {
  const value = context.tenantContext?.tenantId?.trim();
  if (!value) throw new BadRequestError("tenantId is required");
  return value;
};
const permit = (context: RequestContext, permission: Permission) => {
  if (!context.authContext?.user?.permissions.includes(permission)) throw new BadRequestError("permission denied");
};
const resolve = async (deps?: AcademicOfferingServiceDeps) => ({
  repository: await (deps?.repository ?? academicOfferingRepository),
  curricula: await (deps?.curricula ?? curriculumRepository),
  programs: await (deps?.programs ?? programRepository),
  classes: await (deps?.classes ?? classRepository),
  sections: await (deps?.sections ?? sectionRepository),
});

async function validateHierarchy(tenant: string, input: ReturnType<typeof validateAcademicOfferingCreateInput>, deps?: AcademicOfferingServiceDeps) {
  const repositories = await resolve(deps);
  if (deps?.settings) {
    if (!await deps.settings.campusExists(tenant, input.campusId)) throw new NotFoundError("campus not found");
    if (!await deps.settings.academicYearExists(tenant, input.academicYearId)) throw new NotFoundError("academic year not found");
  }
  const [curriculum, program, academicClass, section] = await Promise.all([
    repositories.curricula.getById(tenant, input.curriculumId),
    repositories.programs.getById(tenant, input.programId),
    repositories.classes.getById(tenant, input.classId),
    input.sectionId ? repositories.sections.getById(tenant, input.sectionId) : Promise.resolve(null),
  ]);
  if (!curriculum || curriculum.status !== "ACTIVE") throw new NotFoundError("active curriculum not found");
  if (!program || program.status !== "ACTIVE" || program.campusId !== input.campusId) throw new NotFoundError("active program not found for campus");
  if (!academicClass || academicClass.status !== "ACTIVE" || academicClass.campusId !== input.campusId || academicClass.programId !== input.programId) {
    throw new NotFoundError("active class not found for program and campus");
  }
  if (input.sectionId && (!section || section.status !== "ACTIVE" || section.campusId !== input.campusId || section.programId !== input.programId || section.classId !== input.classId)) {
    throw new NotFoundError("active section not found for class, program and campus");
  }
  return repositories;
}

export async function listAcademicOfferings(context: RequestContext, filter?: unknown, deps?: AcademicOfferingServiceDeps) {
  permit(context, academicOfferingPermissions.read);
  return (await (await resolve(deps)).repository.list(tenantId(context), validateAcademicOfferingListFilter(filter))).map(toAcademicOfferingView);
}
export async function getAcademicOffering(id: string, context: RequestContext, deps?: AcademicOfferingServiceDeps) {
  permit(context, academicOfferingPermissions.read);
  const record = await (await resolve(deps)).repository.getById(tenantId(context), id);
  return record ? toAcademicOfferingView(record) : null;
}
export async function createAcademicOffering(input: unknown, context: RequestContext, deps?: AcademicOfferingServiceDeps) {
  permit(context, academicOfferingPermissions.create);
  const tenant = tenantId(context); const validated = validateAcademicOfferingCreateInput(input);
  const repositories = await validateHierarchy(tenant, validated, deps);
  return toAcademicOfferingView(await repositories.repository.create(tenant, validated));
}
export async function updateAcademicOffering(id: string, input: unknown, context: RequestContext, deps?: AcademicOfferingServiceDeps) {
  permit(context, academicOfferingPermissions.update);
  const tenant = tenantId(context); const repositories = await resolve(deps);
  const record = await repositories.repository.update(tenant, id, validateAcademicOfferingUpdateInput(input));
  return record ? toAcademicOfferingView(record) : null;
}
export async function deactivateAcademicOffering(id: string, context: RequestContext, deps?: AcademicOfferingServiceDeps) {
  permit(context, academicOfferingPermissions.deactivate);
  const record = await (await resolve(deps)).repository.deactivate(tenantId(context), id);
  return record ? toAcademicOfferingView(record) : null;
}
