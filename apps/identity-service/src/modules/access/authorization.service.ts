import { normalizePermissions } from "@school-erp/auth";
import type { AccessRepository } from "./access.repository";
import { accessRepository } from "./access.repository";
import type { ResolvedAuthorizationSnapshot } from "./access.model";
import type { RoleRepository } from "../roles/roles.repository";
import { roleRepository } from "../roles/roles.repository";
import type { UserRepository } from "../users/users.repository";
import { userRepository } from "../users/users.repository";

export interface AuthorizationResolverDependencies {
  accessRepository?: AccessRepository;
  roleRepository?: RoleRepository | Promise<RoleRepository>;
  userRepository?: UserRepository | Promise<UserRepository>;
}

export async function resolvePrincipalAuthorization(
  tenantId: string,
  principalId: string,
  dependencies: AuthorizationResolverDependencies = {},
): Promise<ResolvedAuthorizationSnapshot | null> {
  const users = await (dependencies.userRepository ?? userRepository());
  const user = await users.getByAuthUserId(tenantId, principalId);
  if (!user || user.status !== "ACTIVE") return null;

  const access = dependencies.accessRepository ?? accessRepository;
  const rolesRepository = await (dependencies.roleRepository ?? roleRepository());
  const [assignmentPage, roles, bindings] = await Promise.all([
    access.listAssignmentPage(tenantId, {
      userId: user.id,
      isActive: true,
      page: 1,
      pageSize: 100,
    }),
    rolesRepository.list(tenantId),
    access.listRolePermissions(tenantId),
  ]);
  const roleMap = new Map(roles.filter((role) => role.isActive).map((role) => [role.id, role]));
  const assignments = assignmentPage.items.filter((assignment) => roleMap.has(assignment.roleId));
  const resolvedRoles = assignments.map((assignment) => roleMap.get(assignment.roleId)!);
  const roleIds = new Set(resolvedRoles.map((role) => role.id));

  return {
    userId: user.id,
    principalId,
    ...(resolvedRoles[0]?.code ? { role: resolvedRoles[0].code } : {}),
    roles: resolvedRoles.map((role) => ({ id: role.id, code: role.code, name: role.name })),
    permissions: normalizePermissions(
      bindings
        .filter((binding) => roleIds.has(binding.roleId))
        .map((binding) => binding.permission),
    ),
    scopes: assignments.map((assignment) => ({
      assignmentId: assignment.id,
      roleId: assignment.roleId,
      roleCode: roleMap.get(assignment.roleId)!.code,
      scope: assignment.scope,
    })),
  };
}
