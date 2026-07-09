import type { RoleRecord } from "./roles.model";

export interface RoleRepository {
  list(): Promise<RoleRecord[]>;
  getById(id: string): Promise<RoleRecord | null>;
  create(input: Partial<RoleRecord>): Promise<RoleRecord>;
  update(id: string, input: Partial<RoleRecord>): Promise<RoleRecord | null>;
  delete(id: string): Promise<boolean>;
}

export const roleRepository: RoleRepository = {
  async list() { return []; },
  async getById() { return null; },
  async create(input) { return { ...input } as RoleRecord; },
  async update(_id, input) { return { ...input } as RoleRecord; },
  async delete() { return false; },
};
