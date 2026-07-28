import type { RequestContext } from "@school-erp/api";
import { toClassView } from "../classes.mapper";
import { validateClassCreateInput } from "../classes.validator";
import type { ClassServiceDeps } from "../classes.shared";
import type { ClassView } from "../classes.model";
import { requireClassPermission, requireClassTenantId, resolveClassRepository } from "../classes.shared";
import { classPermissions } from "../classes.permissions";
import type { Permission } from "@school-erp/auth";
import { requireProgramInCampus } from "../../academic-hierarchy.policy";

export async function createClassUseCase(
  input: unknown,
  context: RequestContext,
  deps?: ClassServiceDeps,
): Promise<ClassView> {
  requireClassPermission(context, classPermissions.create as Permission);
  const repository = await resolveClassRepository(deps);
  const tenantId = requireClassTenantId(context);
  const validated = validateClassCreateInput(input);
  await requireProgramInCampus(tenantId, validated.campusId, validated.programId, deps);
  const code = await repository.reserveNextCode(tenantId, validated.campusId);
  const record = await repository.create(tenantId, { ...validated, code });
  return toClassView(record) as ClassView;
}
