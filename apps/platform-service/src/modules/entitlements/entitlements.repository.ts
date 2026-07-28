import {
  createMongoCollectionAdapter,
  getCollection,
  type CollectionAdapter,
  type MongoEnvLike,
} from "@school-erp/mongodb";
import type {
  TenantEntitlementInput,
  TenantEntitlementRecord,
} from "./entitlements.model";
interface Document extends TenantEntitlementRecord {
  _id: string;
}
export interface TenantEntitlementRepository {
  list(tenantId?: string): Promise<TenantEntitlementRecord[]>;
  upsert(input: TenantEntitlementInput): Promise<TenantEntitlementRecord>;
}
const clone = (record: TenantEntitlementRecord) => ({
  ...record,
  limits: record.limits ? { ...record.limits } : undefined,
  createdAt: new Date(record.createdAt),
  updatedAt: new Date(record.updatedAt),
});
export class InMemoryTenantEntitlementRepository
  implements TenantEntitlementRepository
{
  private records = new Map<string, TenantEntitlementRecord>();
  async list(tenantId?: string) {
    return [...this.records.values()]
      .filter((x) => !tenantId || x.tenantId === tenantId)
      .map(clone);
  }
  async upsert(input: TenantEntitlementInput) {
    const id = `${input.tenantId}:${input.featureCode}`;
    const current = this.records.get(id);
    const now = new Date();
    const record = clone({
      id,
      ...input,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    });
    this.records.set(id, record);
    return clone(record);
  }
}
export class MongoTenantEntitlementRepository
  implements TenantEntitlementRepository
{
  constructor(private collection: CollectionAdapter<Document>) {}
  async list(tenantId?: string) {
    return (
      await this.collection.findMany(tenantId ? { tenantId } : {}, {
        sort: { tenantId: 1, featureCode: 1 },
      })
    ).map(({ _id, ...record }) => clone({ ...record, id: record.id || _id }));
  }
  async upsert(input: TenantEntitlementInput) {
    const id = `${input.tenantId}:${input.featureCode}`;
    const existing = await this.collection.findOne({ _id: id });
    const now = new Date();
    const document: Document = {
      _id: id,
      id,
      ...input,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (existing) await this.collection.replaceOne({ _id: id }, document);
    else await this.collection.insertOne(document);
    return clone(document);
  }
}
function env(): MongoEnvLike {
  return (
    (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process
      ?.env ?? {}
  );
}
export async function createTenantEntitlementRepository(
  runtime = env(),
): Promise<TenantEntitlementRepository> {
  if (
    !runtime.MONGODB_URI &&
    !runtime.MONGODB_URI_DEV &&
    !runtime.MONGODB_URI_PROD
  )
    return new InMemoryTenantEntitlementRepository();
  const collection = await getCollection<Document>(
    "platform_tenant_entitlements",
    runtime,
  );
  await collection.createIndex(
    { tenantId: 1, featureCode: 1 },
    { unique: true },
  );
  return new MongoTenantEntitlementRepository(
    createMongoCollectionAdapter(collection),
  );
}
