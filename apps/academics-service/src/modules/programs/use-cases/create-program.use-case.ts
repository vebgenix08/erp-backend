import type { RequestContext } from "@school-erp/api";
import { toProgramView } from "../programs.mapper";
import { validateProgramCreateInput } from "../programs.validator";
import type { ProgramView } from "../programs.model";
import type { ProgramServiceDeps } from "../programs.shared";
import { requirePermission, requireTenantId, resolveProgramRepository } from "../programs.shared";
import { academicsPermissions } from "../../../permissions";
import type { Permission } from "@school-erp/auth";

export async function createProgramUseCase(
  input: unknown,
  context: RequestContext,
  deps?: ProgramServiceDeps,
): Promise<ProgramView> {
  requirePermission(context, academicsPermissions.programs.create as Permission);
  const repository = await resolveProgramRepository(deps);
  const tenantId = requireTenantId(context);
  const validated = validateProgramCreateInput(input);
  const code = await repository.reserveNextCode(tenantId, validated.campusId);
  const record = await repository.create(tenantId, { ...validated, code });
  return toProgramView(record) as ProgramView;
}
