import type { RequestContext } from "@school-erp/api";
import { toSectionView } from "../sections.mapper";
import { validateSectionListFilter } from "../sections.validator";
import type { SectionView } from "../sections.model";
import type { SectionServiceDeps } from "../sections.shared";
import { requireSectionPermission, requireSectionTenantId, resolveSectionRepository } from "../sections.shared";
import { sectionPermissions } from "../sections.permissions";
import type { Permission } from "@school-erp/auth";

export async function listSectionsUseCase(
  context: RequestContext,
  deps?: SectionServiceDeps,
  filter?: unknown,
): Promise<SectionView[]> {
  requireSectionPermission(context, sectionPermissions.read as Permission);
  const repository = await resolveSectionRepository(deps);
  const records = await repository.list(requireSectionTenantId(context), validateSectionListFilter(filter));
  return records.map((record) => toSectionView(record) as SectionView);
}
