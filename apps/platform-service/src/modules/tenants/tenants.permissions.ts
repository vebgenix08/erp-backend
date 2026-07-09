import type { PermissionAction } from "@school-erp/types";

export type TenantPermissionAction =
  | "LIST"
  | "READ"
  | "CREATE"
  | "UPDATE"
  | "DEACTIVATE";

export interface TenantPermissionDefinition {
  action: PermissionAction | TenantPermissionAction;
  resource: string;
}

export const tenantPermissions = {
  list: { action: "READ", resource: "platform.tenants" },
  get: { action: "READ", resource: "platform.tenants" },
  create: { action: "CREATE", resource: "platform.tenants" },
  update: { action: "UPDATE", resource: "platform.tenants" },
  deactivate: { action: "UPDATE", resource: "platform.tenants" },
} as const satisfies Record<string, TenantPermissionDefinition>;
