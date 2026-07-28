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
    create: "identity.permissions.create",
    read: "identity.permissions.read",
    update: "identity.permissions.update",
    delete: "identity.permissions.delete",
  },
  invites: {
    create: "identity.invites.create",
    read: "identity.invites.read",
    delete: "identity.invites.delete",
  },
  cognitoSync: {
    create: "identity.cognito-sync.create",
    read: "identity.cognito-sync.read",
    update: "identity.cognito-sync.update",
    delete: "identity.cognito-sync.delete",
  },
} as const;
