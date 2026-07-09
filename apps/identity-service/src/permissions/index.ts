export const identityPermissions = {
  users: {
    create: "identity.users.create",
    read: "identity.users.read",
    update: "identity.users.update",
    delete: "identity.users.delete",
  },
  roles: {
    create: "identity.roles.create",
    read: "identity.roles.read",
    update: "identity.roles.update",
    delete: "identity.roles.delete",
  },
  permissions: {
    read: "identity.permissions.read",
    update: "identity.permissions.update",
  },
  invites: {
    create: "identity.invites.create",
    read: "identity.invites.read",
    delete: "identity.invites.delete",
  },
  cognitoSync: {
    run: "identity.cognito-sync.run",
  },
} as const;
