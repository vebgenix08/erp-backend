import type { RequestContext } from "@school-erp/api";
import { toClassView } from "../classes.mapper";
import { validateClassListFilter } from "../classes.validator";
import type { ClassView } from "../classes.model";
import type { ClassServiceDeps } from "../classes.shared";
import { requireClassPermission, requireClassTenantId, resolveClassRepository } from "../classes.shared";
import { classPermissions } from "../classes.permissions";
import type { Permission } from "@school-erp/auth";

export async function listClassesUseCase(
  context: RequestContext,
  deps?: ClassServiceDeps,
  filter?: unknown,
): Promise<ClassView[]> {
  requireClassPermission(context, classPermissions.read as Permission);
  const repository = await resolveClassRepository(deps);
  const records = await repository.list(requireClassTenantId(context), validateClassListFilter(filter));
  return records.map((record) => toClassView(record) as ClassView);
}
