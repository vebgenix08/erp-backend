import type { RequestContext } from "@school-erp/api";
import { toClassView } from "../classes.mapper";
import { validateClassUpdateInput } from "../classes.validator";
import type { ClassView } from "../classes.model";
import type { ClassServiceDeps } from "../classes.shared";
import { requireClassPermission, requireClassTenantId, resolveClassRepository } from "../classes.shared";
import { classPermissions } from "../classes.permissions";
import type { Permission } from "@school-erp/auth";
import { requireProgramInCampus } from "../../academic-hierarchy.policy";
import { NotFoundError } from "@school-erp/errors";

export async function updateClassUseCase(
  id: string,
  input: unknown,
  context: RequestContext,
  deps?: ClassServiceDeps,
): Promise<ClassView | null> {
  requireClassPermission(context, classPermissions.update as Permission);
  const repository = await resolveClassRepository(deps);
  const tenantId = requireClassTenantId(context);
  const existing = await repository.getById(tenantId, id);
  if (!existing) throw new NotFoundError("class not found");
  const validated = validateClassUpdateInput(input);
  if (validated.programId) await requireProgramInCampus(tenantId, existing.campusId, validated.programId, deps);
  return toClassView(await repository.update(tenantId, id, validated));
}
