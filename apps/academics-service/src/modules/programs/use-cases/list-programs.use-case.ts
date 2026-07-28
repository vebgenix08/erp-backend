import type { RequestContext } from "@school-erp/api";
import { toProgramView } from "../programs.mapper";
import { validateProgramListFilter } from "../programs.validator";
import type { ProgramView } from "../programs.model";
import type { ProgramServiceDeps } from "../programs.shared";
import { requirePermission, requireTenantId, resolveProgramRepository } from "../programs.shared";
import { academicsPermissions } from "../../../permissions";
import type { Permission } from "@school-erp/auth";

export async function listProgramsUseCase(
  context: RequestContext,
  deps?: ProgramServiceDeps,
  filter?: unknown,
): Promise<ProgramView[]> {
  requirePermission(context, academicsPermissions.programs.read as Permission);
  const repository = await resolveProgramRepository(deps);
  const records = await repository.list(requireTenantId(context), validateProgramListFilter(filter));
  return records.map((record) => toProgramView(record) as ProgramView);
}
