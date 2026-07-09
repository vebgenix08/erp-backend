import type { PermissionRecord } from "./permissions.model";

export interface PermissionRepository {
  list(): Promise<PermissionRecord[]>;
  getById(id: string): Promise<PermissionRecord | null>;
}

export const permissionRepository: PermissionRepository = {
  async list() { return []; },
  async getById() { return null; },
};
