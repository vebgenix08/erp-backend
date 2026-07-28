import type { RequestContext } from "@school-erp/api";
import { toSubjectView } from "../subjects.mapper";
import { validateSubjectUpdateInput } from "../subjects.validator";
import type { SubjectView } from "../subjects.model";
import type { SubjectServiceDeps } from "../subjects.shared";
import { requireSubjectPermission, requireSubjectTenantId, resolveSubjectRepository } from "../subjects.shared";
import { subjectPermissions } from "../subjects.permissions";
import type { Permission } from "@school-erp/auth";
import { requireClassInHierarchy, requireProgramInCampus } from "../../academic-hierarchy.policy";
import { NotFoundError } from "@school-erp/errors";

export async function updateSubjectUseCase(
  id: string,
  input: unknown,
  context: RequestContext,
  deps?: SubjectServiceDeps,
): Promise<SubjectView | null> {
  requireSubjectPermission(context, subjectPermissions.update as Permission);
  const repository = await resolveSubjectRepository(deps);
  const tenantId = requireSubjectTenantId(context);
  const existing = await repository.getById(tenantId, id);
  if (!existing) throw new NotFoundError("subject not found");
  const validated = validateSubjectUpdateInput(input);
  if (validated.programId !== undefined || validated.classId !== undefined) {
    const programId = validated.programId ?? existing.programId;
    const classId = validated.classId ?? existing.classId;
    if (classId) await requireClassInHierarchy(tenantId, existing.campusId, programId, classId, deps);
    else await requireProgramInCampus(tenantId, existing.campusId, programId, deps);
  }
  return toSubjectView(await repository.update(tenantId, id, validated));
}
