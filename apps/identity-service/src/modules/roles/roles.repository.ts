import { BadRequestError, ConflictError } from "@school-erp/errors";
import type { CollectionAdapter, MongoEnvLike } from "@school-erp/mongodb";
import { createMongoCollectionAdapter, getCollection } from "@school-erp/mongodb";
import type { RoleCreateInput, RolePage, RolePageFilter, RoleRecord, RoleUpdateInput } from "./roles.model";

export interface RoleRepository {
  list(tenantId: string): Promise<RoleRecord[]>;
  listPage(tenantId:string,filter?:RolePageFilter):Promise<RolePage>;
  getById(tenantId: string, id: string): Promise<RoleRecord | null>;
  getByCode(tenantId: string, code: string): Promise<RoleRecord | null>;
  create(tenantId: string, input: RoleCreateInput): Promise<RoleRecord>;
  update(tenantId: string, id: string, input: RoleUpdateInput): Promise<RoleRecord | null>;
  delete(tenantId: string, id: string): Promise<boolean>;
}

interface RoleDocument extends RoleRecord {
  _id: string;
}

function now() {
  return new Date();
}

function generateRoleId(): string {
  return `role_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function normalizeTenantId(tenantId: string): string {
  const normalized = tenantId.trim();
  if (!normalized) {
    throw new BadRequestError("tenantId is required");
  }
  return normalized;
}

function cloneRole(role: RoleRecord): RoleRecord {
  return {
    ...role,
    createdAt: new Date(role.createdAt),
    updatedAt: new Date(role.updatedAt),
  };
}

function toRoleDocument(record: RoleRecord): RoleDocument {
  return {
    ...cloneRole(record),
    _id: record.id,
  };
}

function fromRoleDocument(document: RoleDocument | null): RoleRecord | null {
  if (!document) return null;
  const { _id, ...record } = document;
  return cloneRole({
    ...record,
    id: record.id || _id,
  });
}

function toRoleRecord(tenantId: string, input: RoleCreateInput, id = generateRoleId()): RoleRecord {
  const timestamp = now();
  return {
    id,
    tenantId,
    code: normalizeCode(input.code),
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    isSystemRole: input.isSystemRole ?? false,
    isActive: input.isActive ?? true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function mergeRole(existing: RoleRecord, input: RoleUpdateInput): RoleRecord {
  return {
    ...existing,
    code: input.code ? normalizeCode(input.code) : existing.code,
    name: input.name ? input.name.trim() : existing.name,
    description: input.description !== undefined ? input.description?.trim() || undefined : existing.description,
    isSystemRole: input.isSystemRole ?? existing.isSystemRole,
    isActive: input.isActive ?? existing.isActive,
    updatedAt: now(),
  };
}

class InMemoryRoleRepository implements RoleRepository {
  private readonly roles = new Map<string, RoleRecord>();

  async list(tenantId: string) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    return [...this.roles.values()]
      .filter((role) => role.tenantId === normalizedTenantId)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(cloneRole);
  }
  async listPage(tenantId:string,filter:RolePageFilter={}){const search=filter.search?.trim().toLowerCase(),rows=(await this.list(tenantId)).filter(item=>(filter.isActive===undefined||item.isActive===filter.isActive)&&(!search||`${item.name} ${item.code} ${item.description??""}`.toLowerCase().includes(search)));const page=Math.max(1,filter.page??1),pageSize=Math.min(100,Math.max(1,filter.pageSize??25)),total=rows.length;return{items:rows.slice((page-1)*pageSize,page*pageSize),page,pageSize,total,totalPages:Math.ceil(total/pageSize)}}

  async getById(tenantId: string, id: string) {
    const role = this.roles.get(id) ?? null;
    return role && role.tenantId === normalizeTenantId(tenantId) ? cloneRole(role) : null;
  }

  async getByCode(tenantId: string, code: string) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const normalizedCode = normalizeCode(code);
    const role = [...this.roles.values()].find((item) => item.tenantId === normalizedTenantId && item.code === normalizedCode) ?? null;
    return role ? cloneRole(role) : null;
  }

  async create(tenantId: string, input: RoleCreateInput) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const duplicate = await this.getByCode(normalizedTenantId, input.code);
    if (duplicate) {
      throw new ConflictError("role code must be unique within tenant");
    }
    const role = toRoleRecord(normalizedTenantId, input);
    this.roles.set(role.id, role);
    return cloneRole(role);
  }

  async update(tenantId: string, id: string, input: RoleUpdateInput) {
    const existing = this.roles.get(id);
    if (!existing || existing.tenantId !== normalizeTenantId(tenantId)) return null;
    if (input.code !== undefined) {
      const duplicate = await this.getByCode(existing.tenantId, input.code);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError("role code must be unique within tenant");
      }
    }
    const updated = mergeRole(existing, input);
    this.roles.set(id, updated);
    return cloneRole(updated);
  }

  async delete(tenantId: string, id: string) {
    const existing = this.roles.get(id);
    if (!existing || existing.tenantId !== normalizeTenantId(tenantId)) return false;
    return this.roles.delete(id);
  }
}

class MongoRoleRepository implements RoleRepository {
  constructor(private readonly collection: CollectionAdapter<RoleDocument>) {}

  async list(tenantId: string) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    return (await this.collection.findMany({ tenantId: normalizedTenantId }))
      .map((role) => fromRoleDocument(role))
      .filter((role): role is RoleRecord => role !== null)
      .sort((left, right) => left.name.localeCompare(right.name));
  }
  async listPage(tenantId:string,filter:RolePageFilter={}){const query:Record<string,unknown>={tenantId:normalizeTenantId(tenantId)};if(filter.isActive!==undefined)query.isActive=filter.isActive;if(filter.search?.trim())query.$or=[{name:{$regex:filter.search.trim(),$options:"i"}},{code:{$regex:filter.search.trim(),$options:"i"}},{description:{$regex:filter.search.trim(),$options:"i"}}];const page=Math.max(1,filter.page??1),pageSize=Math.min(100,Math.max(1,filter.pageSize??25));const[documents,total]=await Promise.all([this.collection.findMany(query as never,{sort:{name:1,_id:1},skip:(page-1)*pageSize,limit:pageSize}),this.collection.count(query as never)]);return{items:documents.map(item=>fromRoleDocument(item)).filter((item):item is RoleRecord=>Boolean(item)),page,pageSize,total,totalPages:Math.ceil(total/pageSize)}}

  async getById(tenantId: string, id: string) {
    return fromRoleDocument(await this.collection.findOne({ tenantId: normalizeTenantId(tenantId), _id: id }));
  }

  async getByCode(tenantId: string, code: string) {
    return fromRoleDocument(
      await this.collection.findOne({ tenantId: normalizeTenantId(tenantId), code: normalizeCode(code) }),
    );
  }

  async create(tenantId: string, input: RoleCreateInput) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const duplicate = await this.getByCode(normalizedTenantId, input.code);
    if (duplicate) {
      throw new ConflictError("role code must be unique within tenant");
    }
    const role = toRoleRecord(normalizedTenantId, input);
    await this.collection.insertOne(toRoleDocument(role));
    return role;
  }

  async update(tenantId: string, id: string, input: RoleUpdateInput) {
    const existing = await this.getById(tenantId, id);
    if (!existing) return null;
    if (input.code !== undefined) {
      const duplicate = await this.getByCode(existing.tenantId, input.code);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError("role code must be unique within tenant");
      }
    }
    const updated = mergeRole(existing, input);
    const replaced = await this.collection.replaceOne({ tenantId: updated.tenantId, _id: id }, toRoleDocument(updated));
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

export async function createRoleRepository(env: MongoEnvLike = getRuntimeEnv()): Promise<RoleRepository> {
  if (!hasMongoEnv(env)) {
    return new InMemoryRoleRepository();
  }

  const collection = await getCollection<RoleDocument>("identity_roles", env);
  await collection.createIndex({ tenantId: 1, code: 1 }, { unique: true });
  return new MongoRoleRepository(createMongoCollectionAdapter(collection));
}

export const roleRepository = createRoleRepository();

export {
  InMemoryRoleRepository,
  MongoRoleRepository,
  cloneRole,
  fromRoleDocument,
  mergeRole,
  toRoleDocument,
  toRoleRecord,
};
