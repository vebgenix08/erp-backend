import type { RoleCreateInput, RoleUpdateInput } from "../../roles.model";

export function createRoleFixture(overrides: Partial<RoleCreateInput> = {}): Record<string, unknown> {
  return {
    code: "ADMIN",
    name: "Admin",
    isSystemRole: false,
    isActive: true,
    ...overrides,
  };
}

export function updateRoleFixture(overrides: Partial<RoleUpdateInput> = {}): Record<string, unknown> {
  return {
    name: "Updated Admin",
    ...overrides,
  };
}
