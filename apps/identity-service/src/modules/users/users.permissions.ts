export const userPermissions = {
  list: "identity.user.read",
  get: "identity.user.read",
  create: "identity.user.create",
  update: "identity.user.update",
  deactivate: "identity.user.deactivate",
  invite: "identity.user.invite",
} as const;
