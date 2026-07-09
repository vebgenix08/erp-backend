import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId, type Document } from "mongodb";
import {
  BaseRepository,
  TenantScopedBaseRepository,
  createInMemoryCollection,
  createTenantScopeFilter,
  withTransaction,
} from "../index";

interface SampleDocument extends Document {
  _id: ObjectId;
  tenantId?: string;
  name: string;
}

class SamplePlatformRepository extends BaseRepository<SampleDocument> {
  constructor(collection = createInMemoryCollection<SampleDocument>("samples")) {
    super(collection);
  }

  async createSample(name: string) {
    const document: SampleDocument = { _id: new ObjectId(), name };
    return this.insertOne(document);
  }

  async listSamples() {
    return this.findMany();
  }
}

class SampleTenantRepository extends TenantScopedBaseRepository<SampleDocument, { name: string }, { name: string }, SampleDocument> {
  constructor(collection = createInMemoryCollection<SampleDocument>("tenant-samples")) {
    super(collection);
  }

  async list(tenantId: string) {
    return this.findMany(this.tenantFilter(this.requireTenantId(tenantId)));
  }

  async getById(tenantId: string, id: string) {
    return this.findOne(this.tenantFilter(this.requireTenantId(tenantId), { _id: new ObjectId(id) }));
  }

  async create(tenantId: string, input: { name: string }) {
    const document: SampleDocument = { _id: new ObjectId(), tenantId: this.requireTenantId(tenantId), name: input.name };
    return this.insertOne(document);
  }

  async update(tenantId: string, id: string, input: { name: string }) {
    const existing = await this.getById(tenantId, id);
    if (!existing) return null;
    return this.replaceOne(this.tenantFilter(this.requireTenantId(tenantId), { _id: new ObjectId(id) }), {
      ...existing,
      name: input.name,
    });
  }
}

test("base repository stores and lists documents in memory", async () => {
  const repository = new SamplePlatformRepository();
  const created = await repository.createSample("Alpha");
  const records = await repository.listSamples();

  assert.equal(records.length, 1);
  assert.equal(records[0]?.name, "Alpha");
  assert.equal(created.name, "Alpha");
});

test("tenant scoped helpers require tenant id", async () => {
  const repository = new SampleTenantRepository();
  await assert.rejects(() => repository.list(""), /tenantId is required/i);
});

test("tenant scope filter attaches tenant id", () => {
  const filter = createTenantScopeFilter("tenant-1", { name: "Alpha" });
  assert.equal(filter.tenantId, "tenant-1");
  assert.equal(filter.name, "Alpha");
});

test("withTransaction supports no-op mode", async () => {
  const result = await withTransaction(async (session) => {
    assert.equal(session, null);
    return "ok";
  });

  assert.equal(result, "ok");
});
