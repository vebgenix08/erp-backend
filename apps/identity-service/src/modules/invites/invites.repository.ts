import type { InviteRecord } from "./invites.model";

export interface InviteRepository {
  list(): Promise<InviteRecord[]>;
  getById(id: string): Promise<InviteRecord | null>;
  create(input: Partial<InviteRecord>): Promise<InviteRecord>;
  delete(id: string): Promise<boolean>;
}

export const inviteRepository: InviteRepository = {
  async list() { return []; },
  async getById() { return null; },
  async create(input) { return { ...input } as InviteRecord; },
  async delete() { return false; },
};
