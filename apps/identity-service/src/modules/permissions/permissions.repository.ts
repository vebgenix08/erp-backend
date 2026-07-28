import { BadRequestError, ConflictError } from "@school-erp/errors";
import type { CollectionAdapter, MongoEnvLike } from "@school-erp/mongodb";
import { createMongoCollectionAdapter, getCollection } from "@school-erp/mongodb";
import type { PermissionCreateInput, PermissionRecord, PermissionUpdateInput } from "./permissions.model";

export interface PermissionRepository {
  list(tenantId: string): Promise<PermissionRecord[]>;
  getById(tenantId: string, id: string): Promise<PermissionRecord | null>;
  getByCode(tenantId: string, code: string): Promise<PermissionRecord | null>;
  create(tenantId: string, input: PermissionCreateInput): Promise<PermissionRecord>;
  update(tenantId: string, id: string, input: PermissionUpdateInput): Promise<PermissionRecord | null>;
  delete(tenantId: string, id: string): Promise<boolean>;
}

interface PermissionDocument extends PermissionRecord {
  _id: string;
}

function now() {
  return new Date();
}

function generatePermissionId(): string {
  return `permission_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeCode(code: string): string {
  return code.trim();
}

function normalizeTenantId(tenantId: string): string {
  const normalized = tenantId.trim();
  if (!normalized) {
    throw new BadRequestError("tenantId is required");
  }
  return normalized;
}

function clonePermission(permission: PermissionRecord): PermissionRecord {
  return {
    ...permission,
    createdAt: new Date(permission.createdAt),
    updatedAt: new Date(permission.updatedAt),
  };
}

function toPermissionDocument(record: PermissionRecord): PermissionDocument {
  return {
    ...clonePermission(record),
    _id: record.id,
  };
}

function fromPermissionDocument(document: PermissionDocument | null): PermissionRecord | null {
  if (!document) return null;
  const { _id, ...record } = document;
  return clonePermission({
    ...record,
    id: record.id || _id,
  });
}

function toPermissionRecord(tenantId: string, input: PermissionCreateInput, id = generatePermissionId()): PermissionRecord {
  const timestamp = now();
  return {
    id,
    tenantId,
    code: normalizeCode(input.code),
    description: input.description?.trim() || undefined,
    category: input.category?.trim() || undefined,
    isSystemPermission: input.isSystemPermission ?? false,
    isActive: input.isActive ?? true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function mergePermission(existing: PermissionRecord, input: PermissionUpdateInput): PermissionRecord {
  return {
    ...existing,
    code: input.code ? normalizeCode(input.code) : existing.code,
    description: input.description !== undefined ? input.description?.trim() || undefined : existing.description,
    category: input.category !== undefined ? input.category?.trim() || undefined : existing.category,
    isSystemPermission: input.isSystemPermission ?? existing.isSystemPermission,
    isActive: input.isActive ?? existing.isActive,
    updatedAt: now(),
  };
}

class InMemoryPermissionRepository implements PermissionRepository {
  private readonly permissions = new Map<string, PermissionRecord>();

  async list(tenantId: string) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    return [...this.permissions.values()]
      .filter((permission) => permission.tenantId === normalizedTenantId)
      .sort((left, right) => left.code.localeCompare(right.code))
      .map(clonePermission);
  }

  async getById(tenantId: string, id: string) {
    const permission = this.permissions.get(id) ?? null;
    return permission && permission.tenantId === normalizeTenantId(tenantId) ? clonePermission(permission) : null;
  }

  async getByCode(tenantId: string, code: string) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const normalizedCode = normalizeCode(code);
    const permission = [...this.permissions.values()].find(
      (item) => item.tenantId === normalizedTenantId && item.code === normalizedCode,
    ) ?? null;
    return permission ? clonePermission(permission) : null;
  }

  async create(tenantId: string, input: PermissionCreateInput) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const duplicate = await this.getByCode(normalizedTenantId, input.code);
    if (duplicate) {
      throw new ConflictError("permission code must be unique within tenant");
    }
    const permission = toPermissionRecord(normalizedTenantId, input);
    this.permissions.set(permission.id, permission);
    return clonePermission(permission);
  }

  async update(tenantId: string, id: string, input: PermissionUpdateInput) {
    const existing = this.permissions.get(id);
    if (!existing || existing.tenantId !== normalizeTenantId(tenantId)) return null;
    if (input.code !== undefined) {
      const duplicate = await this.getByCode(existing.tenantId, input.code);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError("permission code must be unique within tenant");
      }
    }
    const updated = mergePermission(existing, input);
    this.permissions.set(id, updated);
    return clonePermission(updated);
  }

  async delete(tenantId: string, id: string) {
    const existing = this.permissions.get(id);
    if (!existing || existing.tenantId !== normalizeTenantId(tenantId)) return false;
    return this.permissions.delete(id);
  }
}

class MongoPermissionRepository implements PermissionRepository {
  constructor(private readonly collection: CollectionAdapter<PermissionDocument>) {}

  async list(tenantId: string) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    return (await this.collection.findMany({ tenantId: normalizedTenantId }))
      .map((permission) => fromPermissionDocument(permission))
      .filter((permission): permission is PermissionRecord => permission !== null)
      .sort((left, right) => left.code.localeCompare(right.code));
  }

  async getById(tenantId: string, id: string) {
    return fromPermissionDocument(await this.collection.findOne({ tenantId: normalizeTenantId(tenantId), _id: id }));
  }

  async getByCode(tenantId: string, code: string) {
    return fromPermissionDocument(
      await this.collection.findOne({ tenantId: normalizeTenantId(tenantId), code: normalizeCode(code) }),
    );
  }

  async create(tenantId: string, input: PermissionCreateInput) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const duplicate = await this.getByCode(normalizedTenantId, input.code);
    if (duplicate) {
      throw new ConflictError("permission code must be unique within tenant");
    }
    const permission = toPermissionRecord(normalizedTenantId, input);
    await this.collection.insertOne(toPermissionDocument(permission));
    return permission;
  }

  async update(tenantId: string, id: string, input: PermissionUpdateInput) {
    const existing = await this.getById(tenantId, id);
    if (!existing) return null;
    if (input.code !== undefined) {
      const duplicate = await this.getByCode(existing.tenantId, input.code);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError("permission code must be unique within tenant");
      }
    }
    const updated = mergePermission(existing, input);
    const replaced = await this.collection.replaceOne(
      { tenantId: updated.tenantId, _id: id },
      toPermissionDocument(updated),
    );
    return replaced ? updated : null;
  }

  async delete(tenantId: string, id: string) {
    return this.collection.deleteOne({ tenantId: normalizeTenantId(tenantId), _id: id });
  }
}

function hasMongoEnv(env: MongoEnvLike): boolean {
  return Boolean(env.MONGODB_URI || env.MONGODB_URI_DEV || env.MONGODB_URI_PROD || env.MONGODB_URI_TEST);
}

function getRuntimeEnv(): MongoEnvLike {
  const runtime = globalThis as unknown as { process?: { env?: MongoEnvLike } };
  return runtime.process?.env ?? {};
}

export async function createPermissionRepository(env: MongoEnvLike = getRuntimeEnv()): Promise<PermissionRepository> {
  if (!hasMongoEnv(env)) {
    return new InMemoryPermissionRepository();
  }

  const collection = await getCollection<PermissionDocument>("identity_permissions", env);
  await collection.createIndex({ tenantId: 1, code: 1 }, { unique: true });
  return new MongoPermissionRepository(createMongoCollectionAdapter(collection));
}

export const permissionRepository = createPermissionRepository();

export {
  InMemoryPermissionRepository,
  MongoPermissionRepository,
  clonePermission,
  fromPermissionDocument,
  mergePermission,
  toPermissionDocument,
  toPermissionRecord,
};
