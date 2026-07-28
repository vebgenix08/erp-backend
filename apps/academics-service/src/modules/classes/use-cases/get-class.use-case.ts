import type { RequestContext } from "@school-erp/api";
import { toClassView } from "../classes.mapper";
import type { ClassView } from "../classes.model";
import type { ClassServiceDeps } from "../classes.shared";
import { requireClassPermission, requireClassTenantId, resolveClassRepository } from "../classes.shared";
import { classPermissions } from "../classes.permissions";
import type { Permission } from "@school-erp/auth";

export async function getClassUseCase(id: string, context: RequestContext, deps?: ClassServiceDeps): Promise<ClassView | null> {
  requireClassPermission(context, classPermissions.read as Permission);
  const repository = await resolveClassRepository(deps);
  return toClassView(await repository.getById(requireClassTenantId(context), id));
}
