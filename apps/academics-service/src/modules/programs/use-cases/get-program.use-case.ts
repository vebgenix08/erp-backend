import type { RequestContext } from "@school-erp/api";
import { toProgramView } from "../programs.mapper";
import type { ProgramView } from "../programs.model";
import type { ProgramServiceDeps } from "../programs.shared";
import { requirePermission, requireTenantId, resolveProgramRepository } from "../programs.shared";
import { academicsPermissions } from "../../../permissions";
import type { Permission } from "@school-erp/auth";

export async function getProgramUseCase(
  id: string,
  context: RequestContext,
  deps?: ProgramServiceDeps,
): Promise<ProgramView | null> {
  requirePermission(context, academicsPermissions.programs.read as Permission);
  const repository = await resolveProgramRepository(deps);
  return toProgramView(await repository.getById(requireTenantId(context), id));
}
