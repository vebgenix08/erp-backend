export interface RoleRecord {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string | undefined;
  isSystemRole: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleCreateInput {
  code: string;
  name: string;
  description?: string | undefined;
  isSystemRole?: boolean | undefined;
  isActive?: boolean | undefined;
}

export interface RoleUpdateInput {
  code?: string | undefined;
  name?: string | undefined;
  description?: string | undefined;
  isSystemRole?: boolean | undefined;
  isActive?: boolean | undefined;
}
export interface RolePageFilter { search?:string;isActive?:boolean;page?:number;pageSize?:number }
export interface RolePage { items:RoleRecord[];page:number;pageSize:number;total:number;totalPages:number }
