import type { PermissionCreateInput, PermissionUpdateInput } from "../../permissions.model";

export function createPermissionFixture(overrides: Partial<PermissionCreateInput> = {}): Record<string, unknown> {
  return {
    code: "identity.users.read",
    description: "Read users",
    category: "identity",
    isSystemPermission: true,
    isActive: true,
    ...overrides,
  };
}

export function updatePermissionFixture(overrides: Partial<PermissionUpdateInput> = {}): Record<string, unknown> {
  return {
    description: "Updated description",
    ...overrides,
  };
}
