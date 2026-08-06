import type { RequestContext } from "@school-erp/api";
import type { Permission } from "@school-erp/auth";
import { BadRequestError } from "@school-erp/errors";
import { curriculumPermissions } from "./curricula.permissions";
import type { CurriculumRepository } from "./curricula.repository";
import { curriculumRepository } from "./curricula.repository";
import { toCurriculumView } from "./curricula.mapper";
import { validateCurriculumCreateInput, validateCurriculumListFilter, validateCurriculumUpdateInput } from "./curricula.validator";

export interface CurriculumServiceDeps { repository?: CurriculumRepository | Promise<CurriculumRepository> }
const tenantId = (context: RequestContext) => {
  const value = context.tenantContext?.tenantId?.trim();
  if (!value) throw new BadRequestError("tenantId is required");
  return value;
};
const permit = (context: RequestContext, permission: Permission) => {
  if (!context.authContext?.user?.permissions.includes(permission)) throw new BadRequestError("permission denied");
};
const repository = async (deps?: CurriculumServiceDeps) => await (deps?.repository ?? curriculumRepository);

export async function listCurricula(context: RequestContext, filter?: unknown, deps?: CurriculumServiceDeps) {
  permit(context, curriculumPermissions.read);
  return (await (await repository(deps)).list(tenantId(context), validateCurriculumListFilter(filter))).map(toCurriculumView);
}
export async function getCurriculum(id: string, context: RequestContext, deps?: CurriculumServiceDeps) {
  permit(context, curriculumPermissions.read);
  const record = await (await repository(deps)).getById(tenantId(context), id);
  return record ? toCurriculumView(record) : null;
}
export async function createCurriculum(input: unknown, context: RequestContext, deps?: CurriculumServiceDeps) {
  permit(context, curriculumPermissions.create);
  return toCurriculumView(await (await repository(deps)).create(tenantId(context), validateCurriculumCreateInput(input)));
}
export async function updateCurriculum(id: string, input: unknown, context: RequestContext, deps?: CurriculumServiceDeps) {
  permit(context, curriculumPermissions.update);
  const record = await (await repository(deps)).update(tenantId(context), id, validateCurriculumUpdateInput(input));
  return record ? toCurriculumView(record) : null;
}
export async function deactivateCurriculum(id: string, context: RequestContext, deps?: CurriculumServiceDeps) {
  permit(context, curriculumPermissions.deactivate);
  const record = await (await repository(deps)).deactivate(tenantId(context), id);
  return record ? toCurriculumView(record) : null;
}
