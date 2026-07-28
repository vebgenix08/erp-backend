import type { RequestContext } from "@school-erp/api";
import { toClassView } from "../classes.mapper";
import type { ClassView } from "../classes.model";
import type { ClassServiceDeps } from "../classes.shared";
import { requireClassPermission, requireClassTenantId, resolveClassRepository } from "../classes.shared";
import { classPermissions } from "../classes.permissions";
import type { Permission } from "@school-erp/auth";

export async function deactivateClassUseCase(id: string, context: RequestContext, deps?: ClassServiceDeps): Promise<ClassView | null> {
  requireClassPermission(context, classPermissions.deactivate as Permission);
  const repository = await resolveClassRepository(deps);
  return toClassView(await repository.deactivate(requireClassTenantId(context), id));
}
