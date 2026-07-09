import type { CognitoSyncRecord } from "./cognito-sync.model";

export interface CognitoSyncRepository {
  list(): Promise<CognitoSyncRecord[]>;
  getById(id: string): Promise<CognitoSyncRecord | null>;
}

export const cognitoSyncRepository: CognitoSyncRepository = {
  async list() { return []; },
  async getById() { return null; },
};
