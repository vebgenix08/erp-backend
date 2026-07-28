import type { RequestContext } from "@school-erp/api";
import { toProgramView } from "../programs.mapper";
import { validateProgramUpdateInput } from "../programs.validator";
import type { ProgramView } from "../programs.model";
import type { ProgramServiceDeps } from "../programs.shared";
import { requirePermission, requireTenantId, resolveProgramRepository } from "../programs.shared";
import { academicsPermissions } from "../../../permissions";
import type { Permission } from "@school-erp/auth";

export async function updateProgramUseCase(
  id: string,
  input: unknown,
  context: RequestContext,
  deps?: ProgramServiceDeps,
): Promise<ProgramView | null> {
  requirePermission(context, academicsPermissions.programs.update as Permission);
  const repository = await resolveProgramRepository(deps);
  return toProgramView(await repository.update(requireTenantId(context), id, validateProgramUpdateInput(input)));
}
