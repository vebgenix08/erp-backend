import type { RequestContext } from "@school-erp/api";
import { toSubjectView } from "../subjects.mapper";
import type { SubjectView } from "../subjects.model";
import type { SubjectServiceDeps } from "../subjects.shared";
import { requireSubjectPermission, requireSubjectTenantId, resolveSubjectRepository } from "../subjects.shared";
import { subjectPermissions } from "../subjects.permissions";
import type { Permission } from "@school-erp/auth";

export async function getSubjectUseCase(id: string, context: RequestContext, deps?: SubjectServiceDeps): Promise<SubjectView | null> {
  requireSubjectPermission(context, subjectPermissions.read as Permission);
  const repository = await resolveSubjectRepository(deps);
  return toSubjectView(await repository.getById(requireSubjectTenantId(context), id));
}
