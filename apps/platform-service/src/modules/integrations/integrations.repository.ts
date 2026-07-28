import {
  createMongoCollectionAdapter,
  getCollection,
  type CollectionAdapter,
  type MongoEnvLike,
} from "@school-erp/mongodb";
import type {
  PlatformIntegrationInput,
  PlatformIntegrationRecord,
} from "./integrations.model";
interface Document extends PlatformIntegrationRecord {
  _id: string;
}
export interface PlatformIntegrationRepository {
  list(): Promise<PlatformIntegrationRecord[]>;
  upsert(input: PlatformIntegrationInput): Promise<PlatformIntegrationRecord>;
}
const clone = (x: PlatformIntegrationRecord) => ({
  ...x,
  settings: { ...x.settings },
  createdAt: new Date(x.createdAt),
  updatedAt: new Date(x.updatedAt),
});
export class InMemoryPlatformIntegrationRepository
  implements PlatformIntegrationRepository
{
  private records = new Map<string, PlatformIntegrationRecord>();
  async list() {
    return [...this.records.values()].map(clone);
  }
  async upsert(input: PlatformIntegrationInput) {
    const current = this.records.get(input.code);
    const now = new Date();
    const record = clone({
      id: input.code,
      ...input,
      settings: input.settings ?? {},
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    });
    this.records.set(input.code, record);
    return clone(record);
  }
}
export class MongoPlatformIntegrationRepository
  implements PlatformIntegrationRepository
{
  constructor(private collection: CollectionAdapter<Document>) {}
  async list() {
    return (await this.collection.findMany({}, { sort: { code: 1 } })).map(
      ({ _id, ...x }) => clone({ ...x, id: x.id || _id }),
    );
  }
  async upsert(input: PlatformIntegrationInput) {
    const existing = await this.collection.findOne({ _id: input.code });
    const now = new Date();
    const doc: Document = {
      _id: input.code,
      id: input.code,
      ...input,
      settings: input.settings ?? {},
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (existing) await this.collection.replaceOne({ _id: input.code }, doc);
    else await this.collection.insertOne(doc);
    return clone(doc);
  }
}
function env(): MongoEnvLike {
  return (
    (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process
      ?.env ?? {}
  );
}
export async function createPlatformIntegrationRepository(
  runtime = env(),
): Promise<PlatformIntegrationRepository> {
  if (
    !runtime.MONGODB_URI &&
    !runtime.MONGODB_URI_DEV &&
    !runtime.MONGODB_URI_PROD
  )
    return new InMemoryPlatformIntegrationRepository();
  const c = await getCollection<Document>("platform_integrations", runtime);
  await c.createIndex({ code: 1 }, { unique: true });
  return new MongoPlatformIntegrationRepository(
    createMongoCollectionAdapter(c),
  );
}
