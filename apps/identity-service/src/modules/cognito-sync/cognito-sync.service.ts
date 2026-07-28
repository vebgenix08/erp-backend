import { requirePermission } from "@school-erp/auth";
import { requireTenantId } from "@school-erp/tenancy";
import { cognitoSyncPermissions } from "./cognito-sync.permissions";
import { toCognitoSyncView } from "./cognito-sync.mapper";
import type { CognitoSyncRepository } from "./cognito-sync.repository";
import { cognitoSyncRepository as defaultRepository } from "./cognito-sync.repository";
import { validateCognitoSyncCreateInput, validateCognitoSyncListFilter, validateCognitoSyncUpdateInput } from "./cognito-sync.validator";
import type { CognitoSyncServiceContext, CognitoSyncView } from "./cognito-sync.model";

export interface CognitoSyncServiceDeps {
  repository?: CognitoSyncRepository | Promise<CognitoSyncRepository> | undefined;
}

function resolveRepository(deps?: CognitoSyncServiceDeps): CognitoSyncRepository | Promise<CognitoSyncRepository> {
  return deps?.repository ?? defaultRepository;
}

function tenantId(context: CognitoSyncServiceContext): string {
  return requireTenantId(context.tenantContext);
}

function assertPermission(context: CognitoSyncServiceContext, permission: string): void {
  requirePermission(context.authContext, permission);
}

export async function createCognitoSync(
  input: unknown,
  context: CognitoSyncServiceContext,
  deps?: CognitoSyncServiceDeps,
): Promise<CognitoSyncView> {
  assertPermission(context, cognitoSyncPermissions.create);
  const repository = await resolveRepository(deps);
  const payload = validateCognitoSyncCreateInput(input);
  const record = await repository.create(tenantId(context), payload);
  return toCognitoSyncView(await repository.getById(tenantId(context), record.id)) as CognitoSyncView;
}

export async function getCognitoSync(id: string, context: CognitoSyncServiceContext, deps?: CognitoSyncServiceDeps) {
  assertPermission(context, cognitoSyncPermissions.read);
  const repository = await resolveRepository(deps);
  return toCognitoSyncView(await repository.getById(tenantId(context), id));
}

export async function listCognitoSync(
  context: CognitoSyncServiceContext,
  deps?: CognitoSyncServiceDeps,
  filter?: unknown,
) {
  assertPermission(context, cognitoSyncPermissions.read);
  const repository = await resolveRepository(deps);
  return (await repository.list(tenantId(context), validateCognitoSyncListFilter(filter))).map((record) => toCognitoSyncView(record) as CognitoSyncView);
}

export async function updateCognitoSync(
  id: string,
  input: unknown,
  context: CognitoSyncServiceContext,
  deps?: CognitoSyncServiceDeps,
) {
  assertPermission(context, cognitoSyncPermissions.update);
  const repository = await resolveRepository(deps);
  const updated = await repository.update(tenantId(context), id, validateCognitoSyncUpdateInput(input));
  return toCognitoSyncView(updated);
}

export async function deleteCognitoSync(id: string, context: CognitoSyncServiceContext, deps?: CognitoSyncServiceDeps) {
  assertPermission(context, cognitoSyncPermissions.delete);
  const repository = await resolveRepository(deps);
  return repository.delete(tenantId(context), id);
}
