import {
  createPlatformMongoCollectionAdapter,
  getCollection,
  type MongoEnvLike,
  type PlatformCollectionAdapter,
} from "@school-erp/mongodb";
import type {
  SessionRepository,
  SessionRepositoryRecord,
  SessionTenantSnapshot,
} from "./session.model";

interface SessionDocument extends SessionRepositoryRecord {
  _id: string;
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function cloneTenant(record: SessionTenantSnapshot): SessionTenantSnapshot {
  return { ...record };
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly selectedTenants = new Map<string, SessionRepositoryRecord>();

  async getSelectedTenant(userId: string) {
    const record = this.selectedTenants.get(userId);
    if (!record || record.expiresAt.getTime() <= Date.now()) {
      this.selectedTenants.delete(userId);
      return null;
    }
    return cloneTenant(record.selectedTenant);
  }

  async saveSelectedTenant(userId: string, tenant: SessionTenantSnapshot) {
    const now = new Date();
    this.selectedTenants.set(userId, {
      userId,
      selectedTenant: cloneTenant(tenant),
      updatedAt: now,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    });
    return cloneTenant(tenant);
  }

  async deleteSelectedTenant(userId: string) {
    this.selectedTenants.delete(userId);
  }
}

export class MongoSessionRepository implements SessionRepository {
  constructor(private readonly collection: PlatformCollectionAdapter<SessionDocument>) {}

  async getSelectedTenant(userId: string) {
    const record = await this.collection.findOne({
      _id: userId,
      expiresAt: { $gt: new Date() },
    });
    return record ? cloneTenant(record.selectedTenant) : null;
  }

  async saveSelectedTenant(userId: string, tenant: SessionTenantSnapshot) {
    const now = new Date();
    await this.collection.findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          userId,
          selectedTenant: cloneTenant(tenant),
          updatedAt: now,
          expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
        },
        $setOnInsert: { _id: userId },
      },
      { upsert: true, returnDocument: "after" },
    );
    return cloneTenant(tenant);
  }

  async deleteSelectedTenant(userId: string) {
    await this.collection.deleteOne({ _id: userId });
  }
}

function runtimeEnv(): MongoEnvLike {
  return (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {};
}

function hasMongo(env: MongoEnvLike) {
  return Boolean(
    env.MONGODB_URI || env.MONGODB_URI_DEV || env.MONGODB_URI_PROD || env.MONGODB_URI_TEST,
  );
}

export async function createSessionRepository(
  env: MongoEnvLike = runtimeEnv(),
): Promise<SessionRepository> {
  if (!hasMongo(env)) return new InMemorySessionRepository();
  const collection = await getCollection<SessionDocument>("identity_sessions", env);
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  return new MongoSessionRepository(createPlatformMongoCollectionAdapter(collection));
}

let singleton: Promise<SessionRepository> | undefined;
function repository() {
  return (singleton ??= createSessionRepository());
}

export const sessionRepository: SessionRepository = {
  getSelectedTenant: async (...args) => (await repository()).getSelectedTenant(...args),
  saveSelectedTenant: async (...args) => (await repository()).saveSelectedTenant(...args),
  deleteSelectedTenant: async (...args) => (await repository()).deleteSelectedTenant(...args),
};
