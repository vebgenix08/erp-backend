import type { RequestContext } from "@school-erp/api";
import { toSectionView } from "../sections.mapper";
import { validateSectionCreateInput } from "../sections.validator";
import type { SectionServiceDeps } from "../sections.shared";
import type { SectionView } from "../sections.model";
import { requireSectionPermission, requireSectionTenantId, resolveSectionRepository } from "../sections.shared";
import { sectionPermissions } from "../sections.permissions";
import type { Permission } from "@school-erp/auth";
import { requireClassInHierarchy } from "../../academic-hierarchy.policy";

export async function createSectionUseCase(
  input: unknown,
  context: RequestContext,
  deps?: SectionServiceDeps,
): Promise<SectionView> {
  requireSectionPermission(context, sectionPermissions.create as Permission);
  const repository = await resolveSectionRepository(deps);
  const tenantId = requireSectionTenantId(context);
  const validated = validateSectionCreateInput(input);
  await requireClassInHierarchy(tenantId, validated.campusId, validated.programId, validated.classId, deps);
  const code = await repository.reserveNextCode(tenantId, validated.campusId);
  const record = await repository.create(tenantId, { ...validated, code });
  return toSectionView(record) as SectionView;
}
