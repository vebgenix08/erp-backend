import { ConflictError } from "@school-erp/errors";
import type { CollectionAdapter, MongoEnvLike, PlatformRepository } from "@school-erp/mongodb";
import { createMongoCollectionAdapter, getCollection } from "@school-erp/mongodb";
import type { TenantCreateInput, TenantRecord, TenantUpdateInput } from "./tenants.model";

export interface TenantRepository extends PlatformRepository<TenantRecord, TenantCreateInput, TenantUpdateInput> {
  listPage(input: TenantListQuery): Promise<TenantListPage>;
  getByCode(code: string, context?: unknown): Promise<TenantRecord | null>;
  getBySlug(slug: string): Promise<TenantRecord | null>;
  getByClientRequestId(clientRequestId: string): Promise<TenantRecord | null>;
}

export interface TenantListQuery { limit: number; offset: number; status?: TenantRecord["status"]; search?: string; }
export interface TenantListPage { items: TenantRecord[]; hasNextPage: boolean; }

interface TenantDocument {
  _id: string;
  id: string;
  clientRequestId: string;
  name: string;
  slug?: string | undefined;
  normalizedSlug?: string | undefined;
  code: string;
  normalizedCode: string;
  type: TenantRecord["type"];
  status: TenantRecord["status"];
  contactEmail?: string | undefined;
  contactPhone?: string | undefined;
  address?: string | undefined;
  academicYearStartMonth?: number | undefined;
  createdAt: Date;
  updatedAt: Date;
  deactivatedAt?: Date | undefined;
  deletionRequestedAt?: Date | undefined;
  deletionRequestedBy?: string | undefined;
  deletionReason?: string | undefined;
  deletedAt?: Date | undefined;
  deletedBy?: string | undefined;
  purgeEligibleAt?: Date | undefined;
}

function now() {
  return new Date();
}

function cloneTenant(tenant: TenantRecord): TenantRecord {
  return {
    ...tenant,
    createdAt: new Date(tenant.createdAt),
    updatedAt: new Date(tenant.updatedAt),
    deactivatedAt: tenant.deactivatedAt ? new Date(tenant.deactivatedAt) : undefined,
    deletionRequestedAt: tenant.deletionRequestedAt ? new Date(tenant.deletionRequestedAt) : undefined,
    deletedAt: tenant.deletedAt ? new Date(tenant.deletedAt) : undefined,
    purgeEligibleAt: tenant.purgeEligibleAt ? new Date(tenant.purgeEligibleAt) : undefined,
  };
}

function toTenantDocument(record: TenantRecord): TenantDocument {
  return {
    ...cloneTenant(record),
    _id: record.id,
    normalizedCode: normalizeCode(record.code),
    normalizedSlug: record.slug?.trim().toLowerCase(),
  };
}

function fromTenantDocument(document: TenantDocument | null): TenantRecord | null {
  if (!document) return null;
  const { _id, normalizedCode: _normalizedCode, normalizedSlug: _normalizedSlug, ...record } = document;
  return cloneTenant({
    ...record,
    id: record.id || _id,
  });
}

const TENANT_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TENANT_ID_LENGTH = 6;
const TENANT_ID_GENERATION_ATTEMPTS = 5;

function generateTenantId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TENANT_ID_LENGTH));
  const suffix = Array.from(bytes, (byte) => TENANT_ID_ALPHABET[byte % TENANT_ID_ALPHABET.length]).join("");
  return `tenant_${suffix}`;
}

function toTenantRecord(input: TenantCreateInput, id = generateTenantId()): TenantRecord {
  const timestamp = now();
  return {
    id,
    clientRequestId: input.clientRequestId,
    name: input.name,
    slug: input.slug,
    code: input.code,
    type: input.type,
    status: "ACTIVE",
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    address: input.address,
    academicYearStartMonth: input.academicYearStartMonth,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function normalizeCode(code: string): string {
  return code.trim().toLowerCase();
}
function normalizeSlug(slug: string): string { return slug.trim().toLowerCase(); }

class InMemoryTenantRepository implements TenantRepository {
  private readonly tenants = new Map<string, TenantRecord>();

  async list() {
    return [...this.tenants.values()].sort((left, right) => left.name.localeCompare(right.name)).map(cloneTenant);
  }

  async listPage(input: TenantListQuery) {
    const search = input.search?.trim().toLowerCase();
    const matches = [...this.tenants.values()]
      .filter((tenant) => !input.status || tenant.status === input.status)
      .filter((tenant) => !search || [tenant.name, tenant.code, tenant.slug, tenant.contactEmail].some((value) => value?.toLowerCase().includes(search)))
      .sort((left, right) => left.name.localeCompare(right.name));
    const page = matches.slice(input.offset, input.offset + input.limit + 1);
    return { items: page.slice(0, input.limit).map(cloneTenant), hasNextPage: page.length > input.limit };
  }

  async getById(id: string) {
    const tenant = this.tenants.get(id) ?? null;
    return tenant ? cloneTenant(tenant) : null;
  }

  async getByCode(code: string) {
    const tenant = [...this.tenants.values()].find((item) => item.code.toLowerCase() === normalizeCode(code)) ?? null;
    return tenant ? cloneTenant(tenant) : null;
  }
  async getBySlug(slug: string) { const tenant=[...this.tenants.values()].find((item)=>item.slug&&normalizeSlug(item.slug)===normalizeSlug(slug))??null; return tenant?cloneTenant(tenant):null; }

  async getByClientRequestId(clientRequestId: string) {
    const tenant = [...this.tenants.values()].find((item) => item.clientRequestId === clientRequestId.trim()) ?? null;
    return tenant ? cloneTenant(tenant) : null;
  }

  async create(input: TenantCreateInput) {
    const existing = await this.getByCode(input.code);
    if (existing) {
      throw new ConflictError("tenant code must be unique");
    }
    if (input.slug && await this.getBySlug(input.slug)) throw new ConflictError("tenant slug must be unique");
    for (let attempt = 0; attempt < TENANT_ID_GENERATION_ATTEMPTS; attempt += 1) {
      const tenant = toTenantRecord(input);
      if (this.tenants.has(tenant.id)) continue;
      this.tenants.set(tenant.id, tenant);
      return cloneTenant(tenant);
    }
    throw new ConflictError("unable to allocate a unique tenant id");
  }

  async update(id: string, input: TenantUpdateInput) {
    const existing = this.tenants.get(id);
    if (!existing) return null;
    if (input.code !== undefined) {
      const duplicate = [...this.tenants.values()].find((tenant) => tenant.code.toLowerCase() === normalizeCode(input.code ?? ""));
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError("tenant code must be unique");
      }
    }

    const updated: TenantRecord = {
      ...existing,
      ...input,
      status: input.status ?? existing.status,
      updatedAt: now(),
      deactivatedAt:
        input.status === "INACTIVE" || input.status === "SUSPENDED"
          ? existing.deactivatedAt ?? now()
          : input.status === "ACTIVE"
            ? undefined
            : existing.deactivatedAt,
    };
    this.tenants.set(id, updated);
    return cloneTenant(updated);
  }
}

class MongoTenantRepository implements TenantRepository {
  constructor(private readonly collection: CollectionAdapter<TenantDocument>) {}

  async list() {
    const records = await this.collection.findMany({});
    return records
      .map((record) => fromTenantDocument(record))
      .filter((record): record is TenantRecord => record !== null)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async listPage(input: TenantListQuery) {
    const filter: Record<string, unknown> = {};
    if (input.status) filter.status = input.status;
    if (input.search?.trim()) {
      const escaped = input.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = ["name", "code", "slug", "contactEmail"].map((field) => ({ [field]: { $regex: escaped, $options: "i" } }));
    }
    const records = await this.collection.findMany(filter, { sort: { name: 1, _id: 1 }, skip: input.offset, limit: input.limit + 1 });
    return {
      items: records.slice(0, input.limit).map(fromTenantDocument).filter((record): record is TenantRecord => record !== null),
      hasNextPage: records.length > input.limit,
    };
  }

  async getById(id: string) {
    return fromTenantDocument(await this.collection.findOne({ _id: id }));
  }

  async getByCode(code: string) {
    return fromTenantDocument(await this.collection.findOne({ normalizedCode: normalizeCode(code) }));
  }
  async getBySlug(slug: string) { return fromTenantDocument(await this.collection.findOne({ normalizedSlug: normalizeSlug(slug) })); }

  async getByClientRequestId(clientRequestId: string) {
    return fromTenantDocument(await this.collection.findOne({ clientRequestId: clientRequestId.trim() }));
  }

  async create(input: TenantCreateInput) {
    const existing = await this.getByCode(input.code);
    if (existing) {
      throw new ConflictError("tenant code must be unique");
    }
    if (input.slug && await this.getBySlug(input.slug)) throw new ConflictError("tenant slug must be unique");

    for (let attempt = 0; attempt < TENANT_ID_GENERATION_ATTEMPTS; attempt += 1) {
      const tenant = toTenantRecord(input);
      try {
        await this.collection.insertOne(toTenantDocument(tenant));
        return tenant;
      } catch (error) {
        if (isDuplicateIdError(error)) continue;
        if (isDuplicateKeyError(error)) {
          throw new ConflictError("tenant code, slug, or client request id must be unique");
        }
        throw error;
      }
    }
    throw new ConflictError("unable to allocate a unique tenant id");
  }

  async update(id: string, input: TenantUpdateInput) {
    const existing = await this.getById(id);
    if (!existing) return null;

    if (input.code !== undefined) {
      const duplicate = await this.getByCode(input.code);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError("tenant code must be unique");
      }
    }

    const updated: TenantRecord = {
      ...existing,
      ...input,
      status: input.status ?? existing.status,
      updatedAt: now(),
      deactivatedAt:
        input.status === "INACTIVE" || input.status === "SUSPENDED"
          ? existing.deactivatedAt ?? now()
          : input.status === "ACTIVE"
            ? undefined
            : existing.deactivatedAt,
    };
    const replaced = await this.collection.replaceOne({ _id: id }, toTenantDocument(updated));
    return replaced ? updated : null;
  }
}

function hasMongoEnv(env: MongoEnvLike): boolean {
  return Boolean(env.MONGODB_URI || env.MONGODB_URI_DEV || env.MONGODB_URI_PROD || env.MONGODB_URI_TEST);
}

function isDuplicateKeyError(error: unknown): error is { code: number; keyPattern?: Record<string, unknown> } {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === 11000);
}

function isDuplicateIdError(error: unknown): boolean {
  return isDuplicateKeyError(error) && error.keyPattern?._id === 1;
}

function getRuntimeEnv(): MongoEnvLike {
  const runtime = globalThis as unknown as { process?: { env?: MongoEnvLike } };
  return runtime.process?.env ?? {};
}

export async function createTenantRepository(env: MongoEnvLike = getRuntimeEnv()): Promise<TenantRepository> {
  if (!hasMongoEnv(env)) {
    const runtimeEnvironment = typeof env.environment === "string" ? env.environment : undefined;
    if (runtimeEnvironment === "dev" || runtimeEnvironment === "prod") {
      throw new Error("MongoDB configuration is required for the platform service runtime");
    }
    return new InMemoryTenantRepository();
  }

  const collection = await getCollection<TenantDocument>("platform_tenants", env);
  await collection.createIndex({ normalizedCode: 1 }, { unique: true });
  await collection.createIndex({ normalizedSlug: 1 }, { unique: true, sparse: true });
  await collection.createIndex({ clientRequestId: 1 }, { unique: true });
  return new MongoTenantRepository(createMongoCollectionAdapter(collection));
}

export {
  InMemoryTenantRepository,
  MongoTenantRepository,
  cloneTenant,
  fromTenantDocument,
  generateTenantId,
  toTenantDocument,
  toTenantRecord,
};
