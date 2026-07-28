import type { UserCreateInput, UserUpdateInput } from "../../users.model";

export function createUserFixture(overrides: Partial<UserCreateInput> = {}): Record<string, unknown> {
  return {
    email: "user@example.com",
    name: "Sample User",
    authUserId: "auth-user-1",
    ...overrides,
  };
}

export function updateUserFixture(overrides: Partial<UserUpdateInput> = {}): Record<string, unknown> {
  return {
    name: "Updated User",
    ...overrides,
  };
}
