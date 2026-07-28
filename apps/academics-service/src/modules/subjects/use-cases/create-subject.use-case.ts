import type { RequestContext } from "@school-erp/api";
import { toSubjectView } from "../subjects.mapper";
import { validateSubjectCreateInput } from "../subjects.validator";
import type { SubjectServiceDeps } from "../subjects.shared";
import type { SubjectView } from "../subjects.model";
import { requireSubjectPermission, requireSubjectTenantId, resolveSubjectRepository } from "../subjects.shared";
import { subjectPermissions } from "../subjects.permissions";
import type { Permission } from "@school-erp/auth";
import { requireClassInHierarchy, requireProgramInCampus } from "../../academic-hierarchy.policy";

export async function createSubjectUseCase(
  input: unknown,
  context: RequestContext,
  deps?: SubjectServiceDeps,
): Promise<SubjectView> {
  requireSubjectPermission(context, subjectPermissions.create as Permission);
  const repository = await resolveSubjectRepository(deps);
  const tenantId = requireSubjectTenantId(context);
  const validated = validateSubjectCreateInput(input);
  if (validated.classId) await requireClassInHierarchy(tenantId, validated.campusId, validated.programId, validated.classId, deps);
  else await requireProgramInCampus(tenantId, validated.campusId, validated.programId, deps);
  const code = await repository.reserveNextCode(tenantId, validated.campusId);
  const record = await repository.create(tenantId, { ...validated, code });
  return toSubjectView(record) as SubjectView;
}
