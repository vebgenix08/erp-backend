import { BadRequestError, ConflictError } from "@school-erp/errors";
import type { CollectionAdapter, MongoEnvLike } from "@school-erp/mongodb";
import { createMongoCollectionAdapter, getCollection } from "@school-erp/mongodb";
import type { UserCreateInput, UserPage, UserPageFilter, UserRecord, UserUpdateInput } from "./users.model";

export interface UserRepository {
  list(tenantId: string): Promise<UserRecord[]>;
  listPage(tenantId:string,filter?:UserPageFilter):Promise<UserPage>;
  getById(tenantId: string, id: string): Promise<UserRecord | null>;
  getByEmail(tenantId: string, email: string): Promise<UserRecord | null>;
  getByAuthUserId(tenantId: string, authUserId: string): Promise<UserRecord | null>;
  create(tenantId: string, input: UserCreateInput): Promise<UserRecord>;
  update(tenantId: string, id: string, input: UserUpdateInput): Promise<UserRecord | null>;
  delete(tenantId: string, id: string): Promise<boolean>;
}

interface UserDocument extends UserRecord {
  _id: string;
}

function now() {
  return new Date();
}

function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function cloneUser(user: UserRecord): UserRecord {
  return {
    ...user,
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt),
    deactivatedAt: user.deactivatedAt ? new Date(user.deactivatedAt) : undefined,
  };
}

function toUserDocument(record: UserRecord): UserDocument {
  return {
    ...cloneUser(record),
    _id: record.id,
  };
}

function fromUserDocument(document: UserDocument | null): UserRecord | null {
  if (!document) return null;
  const { _id, ...record } = document;
  return cloneUser({
    ...record,
    id: record.id || _id,
  });
}

function toUserRecord(tenantId: string, input: UserCreateInput, id = generateUserId()): UserRecord {
  const timestamp = now();
  return {
    id,
    tenantId,
    authUserId: input.authUserId,
    email: normalizeEmail(input.email),
    name: input.name.trim(),
    status: input.status ?? "ACTIVE",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function mergeUser(existing: UserRecord, input: UserUpdateInput): UserRecord {
  const nextStatus = input.status ?? existing.status;
  return {
    ...existing,
    authUserId: input.authUserId ?? existing.authUserId,
    email: input.email ? normalizeEmail(input.email) : existing.email,
    name: input.name ? input.name.trim() : existing.name,
    status: nextStatus,
    updatedAt: now(),
    deactivatedAt:
      nextStatus === "INACTIVE" || nextStatus === "SUSPENDED"
        ? existing.deactivatedAt ?? now()
        : nextStatus === "ACTIVE"
          ? undefined
          : existing.deactivatedAt,
  };
}

function normalizeTenantId(tenantId: string): string {
  const normalized = tenantId.trim();
  if (!normalized) {
    throw new BadRequestError("tenantId is required");
  }
  return normalized;
}

class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, UserRecord>();

  async list(tenantId: string) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    return [...this.users.values()]
      .filter((user) => user.tenantId === normalizedTenantId)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(cloneUser);
  }
  async listPage(tenantId:string,filter:UserPageFilter={}){const search=filter.search?.trim().toLowerCase(),rows=(await this.list(tenantId)).filter(item=>(!filter.status||item.status===filter.status)&&(!search||`${item.name} ${item.email}`.toLowerCase().includes(search)));const page=Math.max(1,filter.page??1),pageSize=Math.min(100,Math.max(1,filter.pageSize??25)),total=rows.length;return{items:rows.slice((page-1)*pageSize,page*pageSize),page,pageSize,total,totalPages:Math.ceil(total/pageSize)}}

  async getById(tenantId: string, id: string) {
    const user = this.users.get(id) ?? null;
    return user && user.tenantId === normalizeTenantId(tenantId) ? cloneUser(user) : null;
  }

  async getByEmail(tenantId: string, email: string) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const normalizedEmail = normalizeEmail(email);
    const user = [...this.users.values()].find((item) => item.tenantId === normalizedTenantId && item.email === normalizedEmail) ?? null;
    return user ? cloneUser(user) : null;
  }

  async getByAuthUserId(tenantId: string, authUserId: string) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const user = [...this.users.values()].find((item) => item.tenantId === normalizedTenantId && item.authUserId === authUserId) ?? null;
    return user ? cloneUser(user) : null;
  }

  async create(tenantId: string, input: UserCreateInput) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const duplicate = await this.getByEmail(normalizedTenantId, input.email);
    if (duplicate) {
      throw new ConflictError("user email must be unique within tenant");
    }
    const user = toUserRecord(normalizedTenantId, input);
    this.users.set(user.id, user);
    return cloneUser(user);
  }

  async update(tenantId: string, id: string, input: UserUpdateInput) {
    const existing = this.users.get(id);
    if (!existing || existing.tenantId !== normalizeTenantId(tenantId)) return null;
    if (input.email) {
      const duplicate = await this.getByEmail(existing.tenantId, input.email);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError("user email must be unique within tenant");
      }
    }
    const updated = mergeUser(existing, input);
    this.users.set(id, updated);
    return cloneUser(updated);
  }

  async delete(tenantId: string, id: string) {
    const existing = this.users.get(id);
    if (!existing || existing.tenantId !== normalizeTenantId(tenantId)) return false;
    return this.users.delete(id);
  }
}

class MongoUserRepository implements UserRepository {
  constructor(private readonly collection: CollectionAdapter<UserDocument>) {}

  async list(tenantId: string) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    return (await this.collection.findMany({ tenantId: normalizedTenantId }))
      .map((record) => fromUserDocument(record))
      .filter((record): record is UserRecord => record !== null)
      .sort((left, right) => left.name.localeCompare(right.name));
  }
  async listPage(tenantId:string,filter:UserPageFilter={}){const query:Record<string,unknown>={tenantId:normalizeTenantId(tenantId)};if(filter.status)query.status=filter.status;if(filter.search?.trim())query.$or=[{name:{$regex:filter.search.trim(),$options:"i"}},{email:{$regex:filter.search.trim(),$options:"i"}}];const page=Math.max(1,filter.page??1),pageSize=Math.min(100,Math.max(1,filter.pageSize??25));const[documents,total]=await Promise.all([this.collection.findMany(query as never,{sort:{name:1,_id:1},skip:(page-1)*pageSize,limit:pageSize}),this.collection.count(query as never)]);return{items:documents.map(item=>fromUserDocument(item)).filter((item):item is UserRecord=>Boolean(item)),page,pageSize,total,totalPages:Math.ceil(total/pageSize)}}

  async getById(tenantId: string, id: string) {
    return fromUserDocument(await this.collection.findOne({ tenantId: normalizeTenantId(tenantId), _id: id }));
  }

  async getByEmail(tenantId: string, email: string) {
    return fromUserDocument(
      await this.collection.findOne({ tenantId: normalizeTenantId(tenantId), email: normalizeEmail(email) }),
    );
  }

  async getByAuthUserId(tenantId: string, authUserId: string) {
    return fromUserDocument(await this.collection.findOne({ tenantId: normalizeTenantId(tenantId), authUserId }));
  }

  async create(tenantId: string, input: UserCreateInput) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const duplicate = await this.getByEmail(normalizedTenantId, input.email);
    if (duplicate) {
      throw new ConflictError("user email must be unique within tenant");
    }
    const user = toUserRecord(normalizedTenantId, input);
    await this.collection.insertOne(toUserDocument(user));
    return user;
  }

  async update(tenantId: string, id: string, input: UserUpdateInput) {
    const existing = await this.getById(tenantId, id);
    if (!existing) return null;
    if (input.email) {
      const duplicate = await this.getByEmail(existing.tenantId, input.email);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError("user email must be unique within tenant");
      }
    }
    const updated = mergeUser(existing, input);
    const replaced = await this.collection.replaceOne({ tenantId: updated.tenantId, _id: id }, toUserDocument(updated));
    return replaced ? updated : null;
  }

  async delete(tenantId: string, id: string) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    return this.collection.deleteOne({ tenantId: normalizedTenantId, _id: id });
  }
}

function hasMongoEnv(env: MongoEnvLike): boolean {
  return Boolean(env.MONGODB_URI || env.MONGODB_URI_DEV || env.MONGODB_URI_PROD || env.MONGODB_URI_TEST);
}

function getRuntimeEnv(): MongoEnvLike {
  const runtime = globalThis as unknown as { process?: { env?: MongoEnvLike } };
  return runtime.process?.env ?? {};
}

export async function createUserRepository(env: MongoEnvLike = getRuntimeEnv()): Promise<UserRepository> {
  if (!hasMongoEnv(env)) {
    return new InMemoryUserRepository();
  }

  const collection = await getCollection<UserDocument>("identity_users", env);
  await collection.createIndex({ tenantId: 1, email: 1 }, { unique: true });
  await collection.createIndex({ tenantId: 1, authUserId: 1 }, { unique: true, sparse: true });
  return new MongoUserRepository(createMongoCollectionAdapter(collection));
}

export const userRepository = createUserRepository();

export {
  InMemoryUserRepository,
  MongoUserRepository,
  cloneUser,
  fromUserDocument,
  mergeUser,
  normalizeEmail,
  toUserDocument,
  toUserRecord,
};
