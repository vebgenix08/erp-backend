import test from "node:test";
import assert from "node:assert/strict";
import { MongoClient, type Document } from "mongodb";
import { createMongoCollectionAdapter, createTenantMongoCollection } from "../index";

interface SearchDocument extends Document {
  _id: string;
  tenantId: string;
  name: string;
  email: string;
  status: "ACTIVE" | "INACTIVE";
}

const uri = (
  globalThis as unknown as {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env?.MONGODB_INTEGRATION_URI;

test(
  "Mongo adapter preserves tenant isolation for regex, or, paging and uniqueness",
  { skip: !uri },
  async () => {
    const client = new MongoClient(uri!);
    await client.connect();
    const database = client.db(`mongodb_contract_${Date.now()}`);
    try {
      const native = database.collection<SearchDocument>("search_records");
      await native.createIndex({ tenantId: 1, email: 1 }, { unique: true });
      const collection = createMongoCollectionAdapter(native);
      const guardedNative = createTenantMongoCollection(native);
      assert.throws(() => guardedNative.findOne({ _id: "one" } as never), /tenantId is required/);
      assert.throws(
        () => guardedNative.aggregate([{ $match: { status: "ACTIVE" } }]),
        /tenantId is required/,
      );
      assert.throws(
        () =>
          guardedNative.updateOne(
            { tenantId: "tenant-one", _id: "one" },
            { $set: { tenantId: "tenant-two" } },
          ),
        /tenantId cannot be changed/,
      );
      await collection.insertOne({
        _id: "one",
        tenantId: "tenant-one",
        name: "Ananya Rao",
        email: "ananya@example.com",
        status: "ACTIVE",
      });
      await collection.insertOne({
        _id: "two",
        tenantId: "tenant-one",
        name: "Vikram Singh",
        email: "vikram@example.com",
        status: "ACTIVE",
      });
      await collection.insertOne({
        _id: "three",
        tenantId: "tenant-two",
        name: "Ananya Rao",
        email: "ananya@example.com",
        status: "ACTIVE",
      });

      const page = await collection.findMany(
        {
          tenantId: "tenant-one",
          $or: [
            { name: { $regex: "ananya", $options: "i" } },
            { email: { $regex: "ananya", $options: "i" } },
          ],
        },
        { sort: { name: 1 }, skip: 0, limit: 10 },
      );
      assert.deepEqual(
        page.map((record) => record._id),
        ["one"],
      );
      assert.equal(await collection.count({ tenantId: "tenant-one", status: "ACTIVE" }), 2);
      await assert.rejects(
        () =>
          collection.insertOne({
            _id: "duplicate",
            tenantId: "tenant-one",
            name: "Duplicate",
            email: "ananya@example.com",
            status: "ACTIVE",
          }),
        /duplicate key/i,
      );
    } finally {
      await database.dropDatabase();
      await client.close();
    }
  },
);
