import { createMongoCollectionAdapter, getCollection, type CollectionAdapter, type MongoEnvLike, type RepositoryContext } from "@school-erp/mongodb";
import type {
  InstitutionProfileInput,
  InstitutionProfileRecord,
  InstitutionProfileUpdateInput,
} from "./institution.model";

export interface InstitutionRepository {
  list(tenantId: string, context?: RepositoryContext): Promise<InstitutionProfileRecord[]>;
  getById(tenantId: string, id: string, context?: RepositoryContext): Promise<InstitutionProfileRecord | null>;
  create(tenantId: string, input: InstitutionProfileInput, context?: RepositoryContext): Promise<InstitutionProfileRecord>;
  update(tenantId: string, id: string, input: InstitutionProfileUpdateInput, context?: RepositoryContext): Promise<InstitutionProfileRecord | null>;
}

function now() {
  return new Date();
}

function clone(record: InstitutionProfileRecord): InstitutionProfileRecord {
  return { ...record, createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt) };
}

export class InMemoryInstitutionRepository implements InstitutionRepository {
  private readonly records = new Map<string, InstitutionProfileRecord>();

  async list(tenantId: string, _context?: RepositoryContext) {
    const record = this.records.get(tenantId);
    return record ? [clone(record)] : [];
  }

  async getById(tenantId: string, _id: string, _context?: RepositoryContext) {
    const record = this.records.get(tenantId);
    return record ? clone(record) : null;
  }

  async create(tenantId: string, input: InstitutionProfileInput, _context?: RepositoryContext) {
    const timestamp = now();
    const record: InstitutionProfileRecord = {
      id: `institution_${tenantId}`,
      tenantId,
      name: input.name,
      shortName: input.shortName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      address: input.address,
      logoUrl: input.logoUrl,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.records.set(tenantId, record);
    return clone(record);
  }

  async update(tenantId: string, _id: string, input: InstitutionProfileUpdateInput, _context?: RepositoryContext) {
    const existing = this.records.get(tenantId);
    if (!existing) return null;
    const updated: InstitutionProfileRecord = {
      ...existing,
      ...input,
      updatedAt: now(),
    };
    this.records.set(tenantId, updated);
    return clone(updated);
  }
}

interface InstitutionDocument extends InstitutionProfileRecord { _id: string; }

export class MongoInstitutionRepository implements InstitutionRepository {
  constructor(private readonly collection: CollectionAdapter<InstitutionDocument>) {}
  async list(tenantId: string) { const row = await this.getById(tenantId, "institution"); return row ? [row] : []; }
  async getById(tenantId: string, _id: string) { const row = await this.collection.findOne({ _id: `institution_${tenantId}`, tenantId }); if (!row) return null; const { _id: _ignored, ...record } = row; return clone(record); }
  async create(tenantId: string, input: InstitutionProfileInput) { const timestamp=now(); const record:InstitutionProfileRecord={id:`institution_${tenantId}`,tenantId,...input,createdAt:timestamp,updatedAt:timestamp}; await this.collection.insertOne({_id:record.id,...record}); return clone(record); }
  async update(tenantId: string, _id: string, input: InstitutionProfileUpdateInput) { const existing=await this.getById(tenantId,"institution"); if(!existing)return null; const updated={...existing,...input,updatedAt:now()}; await this.collection.replaceOne({_id:existing.id,tenantId},{_id:existing.id,...updated}); return clone(updated); }
}

function runtimeEnv(): MongoEnvLike { return (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {}; }
let defaultRepository: Promise<InstitutionRepository> | undefined;
export async function createInstitutionRepository(env: MongoEnvLike = runtimeEnv()): Promise<InstitutionRepository> { if(!env.MONGODB_URI&&!env.MONGODB_URI_DEV&&!env.MONGODB_URI_PROD&&!env.MONGODB_URI_TEST)return new InMemoryInstitutionRepository(); const collection=await getCollection<InstitutionDocument>("settings_institution_profiles",env); await collection.createIndex({tenantId:1},{unique:true}); return new MongoInstitutionRepository(createMongoCollectionAdapter(collection)); }
async function getDefaultRepository(){defaultRepository??=createInstitutionRepository();return defaultRepository;}
export const institutionRepository: InstitutionRepository = {
  list: async (...args) => (await getDefaultRepository()).list(...args), getById: async (...args) => (await getDefaultRepository()).getById(...args), create: async (...args) => (await getDefaultRepository()).create(...args), update: async (...args) => (await getDefaultRepository()).update(...args),
};
