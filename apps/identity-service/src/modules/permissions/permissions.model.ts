export interface PermissionRecord {
  id: string;
  tenantId: string;
  code: string;
  description?: string | undefined;
  category?: string | undefined;
  isSystemPermission: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PermissionCreateInput {
  code: string;
  description?: string | undefined;
  category?: string | undefined;
  isSystemPermission?: boolean | undefined;
  isActive?: boolean | undefined;
}

export interface PermissionUpdateInput {
  code?: string | undefined;
  description?: string | undefined;
  category?: string | undefined;
  isSystemPermission?: boolean | undefined;
  isActive?: boolean | undefined;
}
