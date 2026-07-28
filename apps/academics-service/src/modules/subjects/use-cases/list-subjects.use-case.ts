import type { RequestContext } from "@school-erp/api";
import { toSubjectView } from "../subjects.mapper";
import { validateSubjectListFilter } from "../subjects.validator";
import type { SubjectView } from "../subjects.model";
import type { SubjectServiceDeps } from "../subjects.shared";
import { requireSubjectPermission, requireSubjectTenantId, resolveSubjectRepository } from "../subjects.shared";
import { subjectPermissions } from "../subjects.permissions";
import type { Permission } from "@school-erp/auth";

export async function listSubjectsUseCase(
  context: RequestContext,
  deps?: SubjectServiceDeps,
  filter?: unknown,
): Promise<SubjectView[]> {
  requireSubjectPermission(context, subjectPermissions.read as Permission);
  const repository = await resolveSubjectRepository(deps);
  const records = await repository.list(requireSubjectTenantId(context), validateSubjectListFilter(filter));
  return records.map((record) => toSubjectView(record) as SubjectView);
}
