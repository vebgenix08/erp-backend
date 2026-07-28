import type { RequestContext } from "@school-erp/api";
import { toSectionView } from "../sections.mapper";
import type { SectionView } from "../sections.model";
import type { SectionServiceDeps } from "../sections.shared";
import { requireSectionPermission, requireSectionTenantId, resolveSectionRepository } from "../sections.shared";
import { sectionPermissions } from "../sections.permissions";
import type { Permission } from "@school-erp/auth";

export async function deactivateSectionUseCase(id: string, context: RequestContext, deps?: SectionServiceDeps): Promise<SectionView | null> {
  requireSectionPermission(context, sectionPermissions.deactivate as Permission);
  const repository = await resolveSectionRepository(deps);
  return toSectionView(await repository.deactivate(requireSectionTenantId(context), id));
}
