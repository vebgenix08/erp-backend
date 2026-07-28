export const platformPermissions = {
  tenants: {
    create: "platform.tenants.create",
    read: "platform.tenants.read",
    update: "platform.tenants.update",
    delete: "platform.tenants.delete",
  },
  bootstrap: {
    create: "platform.bootstrap.create",
    read: "platform.bootstrap.read",
    complete: "platform.bootstrap.complete",
  },
  dashboard: {
    read: "platform.dashboard.read",
  },
  featureFlags: {
    read: "platform.feature-flags.read",
    create: "platform.feature-flags.create",
    update: "platform.feature-flags.update",
  },
  auditLogs: {
    read: "platform.audit-logs.read",
    create: "platform.audit-logs.create",
  },
  entitlements: {
    read: "platform.entitlements.read",
    manage: "platform.entitlements.manage",
  },
  integrations: {
    read: "platform.integrations.read",
    manage: "platform.integrations.manage",
  },
} as const;
