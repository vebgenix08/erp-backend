import type { TenantContext } from "@school-erp/tenancy";
import { requireTenant } from "@school-erp/tenancy";
import { ConflictError } from "@school-erp/errors";
import { toRoleView } from "./roles.mapper";
import type { RoleRepository } from "./roles.repository";
import { createRoleRepository } from "./roles.repository";
import { validateRoleCreateInput, validateRoleUpdateInput } from "./roles.validator";

export type RoleServiceDeps = {
  repository?: RoleRepository | Promise<RoleRepository>;
};

let defaultRepository: Promise<RoleRepository> | undefined;
function resolveRepository(deps?: RoleServiceDeps) { return deps?.repository ?? (defaultRepository ??= createRoleRepository()); }

function resolveTenantId(context: TenantContext | undefined): string {
  return requireTenant(context).tenantId as string;
}

const SYSTEM_ROLES = [
  ["TENANT_ADMIN", "Tenant Admin", "Full administration within the current tenant"],
  ["ADMIN", "Administrator", "Operational tenant administration"],
  ["PRINCIPAL", "Principal", "Institution oversight and approvals"],
  ["HOD", "Head of Department", "Assigned academic program oversight"],
  ["ACCOUNTANT", "Accountant", "Fee and finance operations"],
  ["ADMISSION_OFFICER", "Admission Officer", "Enquiry and admission workflow"],
  ["TEACHER", "Teacher", "Assigned teaching responsibilities"],
  ["CLASS_TEACHER", "Class Teacher", "Assigned section responsibilities"],
  ["LIBRARIAN", "Librarian", "Library operations"],
  ["EXAM_COORDINATOR", "Exam Coordinator", "Exam and result operations"],
  ["HR_MANAGER", "HR Manager", "Staff administration"],
] as const;

async function ensureSystemRoles(tenantId: string, repository: RoleRepository): Promise<void> {
  const existing = await repository.list(tenantId);
  const existingCodes = new Set(existing.map((role) => role.code));
  for (const [code, name, description] of SYSTEM_ROLES) {
    if (existingCodes.has(code)) continue;
    try { await repository.create(tenantId, { code, name, description, isSystemRole: true, isActive: true }); }
    catch (error) { if (!(error instanceof ConflictError)) throw error; }
  }
}

export async function listRoles(context: TenantContext | undefined, deps?: RoleServiceDeps) {
  const repository = await resolveRepository(deps);
  const tenantId = resolveTenantId(context);
  await ensureSystemRoles(tenantId, repository);
  return (await repository.list(tenantId)).map((role) => toRoleView(role));
}
export async function listRolePage(context:TenantContext|undefined,filter:import("./roles.model").RolePageFilter={},deps?:RoleServiceDeps){const repository=await resolveRepository(deps),tenantId=resolveTenantId(context);await ensureSystemRoles(tenantId,repository);const page=await repository.listPage(tenantId,filter);return{...page,items:page.items.map(role=>toRoleView(role))}}

export async function getRole(context: TenantContext | undefined, id: string, deps?: RoleServiceDeps) {
  const repository = await resolveRepository(deps);
  return toRoleView(await repository.getById(resolveTenantId(context), id));
}

export async function createRole(context: TenantContext | undefined, input: Record<string, unknown>, deps?: RoleServiceDeps) {
  const repository = await resolveRepository(deps);
  const payload = validateRoleCreateInput(input);
  return toRoleView(await repository.create(resolveTenantId(context), { ...payload, isSystemRole: false }));
}

export async function updateRole(
  context: TenantContext | undefined,
  id: string,
  input: Record<string, unknown>,
  deps?: RoleServiceDeps,
) {
  const repository = await resolveRepository(deps);
  const tenantId = resolveTenantId(context);
  const existing = await repository.getById(tenantId, id);
  if (existing?.isSystemRole && (input.code !== undefined || input.isSystemRole !== undefined || input.isActive === false)) {
    throw new ConflictError("system role identity and activation cannot be changed");
  }
  return toRoleView(await repository.update(tenantId, id, validateRoleUpdateInput(input)));
}

export async function deleteRole(context: TenantContext | undefined, id: string, deps?: RoleServiceDeps) {
  const repository = await resolveRepository(deps);
  return repository.delete(resolveTenantId(context), id);
}
