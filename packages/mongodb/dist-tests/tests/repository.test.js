"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const mongodb_1 = require("mongodb");
const index_1 = require("../index");
class SamplePlatformRepository extends index_1.BaseRepository {
    constructor(collection = (0, index_1.createInMemoryCollection)("samples")) {
        super(collection);
    }
    async createSample(name) {
        const document = { _id: new mongodb_1.ObjectId(), name };
        return this.insertOne(document);
    }
    async listSamples() {
        return this.findMany();
    }
}
class SampleTenantRepository extends index_1.TenantScopedBaseRepository {
    constructor(collection = (0, index_1.createInMemoryCollection)("tenant-samples")) {
        super(collection);
    }
    async list(tenantId) {
        return this.findMany(this.tenantFilter(this.requireTenantId(tenantId)));
    }
    async getById(tenantId, id) {
        return this.findOne(this.tenantFilter(this.requireTenantId(tenantId), { _id: new mongodb_1.ObjectId(id) }));
    }
    async create(tenantId, input) {
        const document = { _id: new mongodb_1.ObjectId(), tenantId: this.requireTenantId(tenantId), name: input.name };
        return this.insertOne(document);
    }
    async update(tenantId, id, input) {
        const existing = await this.getById(tenantId, id);
        if (!existing)
            return null;
        return this.replaceOne(this.tenantFilter(this.requireTenantId(tenantId), { _id: new mongodb_1.ObjectId(id) }), {
            ...existing,
            name: input.name,
        });
    }
}
(0, node_test_1.default)("base repository stores and lists documents in memory", async () => {
    const repository = new SamplePlatformRepository();
    const created = await repository.createSample("Alpha");
    const records = await repository.listSamples();
    strict_1.default.equal(records.length, 1);
    strict_1.default.equal(records[0]?.name, "Alpha");
    strict_1.default.equal(created.name, "Alpha");
});
(0, node_test_1.default)("tenant scoped helpers require tenant id", async () => {
    const repository = new SampleTenantRepository();
    await strict_1.default.rejects(() => repository.list(""), /tenantId is required/i);
});
(0, node_test_1.default)("tenant scope filter attaches tenant id", () => {
    const filter = (0, index_1.createTenantScopeFilter)("tenant-1", { name: "Alpha" });
    strict_1.default.equal(filter.tenantId, "tenant-1");
    strict_1.default.equal(filter.name, "Alpha");
});
(0, node_test_1.default)("withTransaction supports no-op mode", async () => {
    const result = await (0, index_1.withTransaction)(async (session) => {
        strict_1.default.equal(session, null);
        return "ok";
    });
    strict_1.default.equal(result, "ok");
});
