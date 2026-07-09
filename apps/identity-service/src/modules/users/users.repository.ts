import type { UserRecord } from "./users.model";

export interface UserRepository {
  list(): Promise<UserRecord[]>;
  getById(id: string): Promise<UserRecord | null>;
  create(input: Partial<UserRecord>): Promise<UserRecord>;
  update(id: string, input: Partial<UserRecord>): Promise<UserRecord | null>;
  delete(id: string): Promise<boolean>;
}

export const userRepository: UserRepository = {
  async list() { return []; },
  async getById() { return null; },
  async create(input) { return { ...input } as UserRecord; },
  async update(_id, input) { return { ...input } as UserRecord; },
  async delete() { return false; },
};
