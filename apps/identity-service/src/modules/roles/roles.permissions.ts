export const rolePermissions = {
  list: "identity.role.read",
  get: "identity.role.read",
  create: "identity.role.create",
  update: "identity.role.update",
  deactivate: "identity.role.deactivate",
  assign: "identity.role.assign",
} as const;
