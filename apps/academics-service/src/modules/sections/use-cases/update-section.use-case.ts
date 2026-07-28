import type { RequestContext } from "@school-erp/api";
import { toSectionView } from "../sections.mapper";
import { validateSectionUpdateInput } from "../sections.validator";
import type { SectionView } from "../sections.model";
import type { SectionServiceDeps } from "../sections.shared";
import { requireSectionPermission, requireSectionTenantId, resolveSectionRepository } from "../sections.shared";
import { sectionPermissions } from "../sections.permissions";
import type { Permission } from "@school-erp/auth";
import { requireClassInHierarchy } from "../../academic-hierarchy.policy";
import { NotFoundError } from "@school-erp/errors";

export async function updateSectionUseCase(
  id: string,
  input: unknown,
  context: RequestContext,
  deps?: SectionServiceDeps,
): Promise<SectionView | null> {
  requireSectionPermission(context, sectionPermissions.update as Permission);
  const repository = await resolveSectionRepository(deps);
  const tenantId = requireSectionTenantId(context);
  const existing = await repository.getById(tenantId, id);
  if (!existing) throw new NotFoundError("section not found");
  const validated = validateSectionUpdateInput(input);
  if (validated.programId || validated.classId) {
    await requireClassInHierarchy(tenantId, existing.campusId, validated.programId ?? existing.programId, validated.classId ?? existing.classId, deps);
  }
  return toSectionView(await repository.update(tenantId, id, validated));
}
