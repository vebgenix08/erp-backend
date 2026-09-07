import test from "node:test";
import assert from "node:assert/strict";
import type { Document } from "mongodb";
import {
  createInMemoryCollection,
  createTenantCollectionAdapter,
  getCollectionFromDb,
} from "../index";

test("getCollectionFromDb returns a named collection adapter from a db", () => {
  const db = {
    collection(name: string) {
      return { collectionName: name };
    },
  } as never;

  const collection = getCollectionFromDb(db, "students");
  assert.equal(collection.collectionName, "students");
});

interface TenantDocument extends Document {
  _id: string;
  tenantId: string;
  name: string;
}

test("tenant adapter rejects an unscoped filter even when types are bypassed", () => {
  const collection = createTenantCollectionAdapter(
    createInMemoryCollection<TenantDocument>("tenant-records"),
  );
  assert.throws(() => collection.findMany({} as never), /tenantId is required/i);
});

test("tenant adapter isolates reads and rejects ownership changes", async () => {
  const collection = createTenantCollectionAdapter(
    createInMemoryCollection<TenantDocument>("tenant-records", [
      { _id: "one", tenantId: "tenant-one", name: "One" },
      { _id: "two", tenantId: "tenant-two", name: "Two" },
    ]),
  );
  const records = await collection.findMany({ tenantId: "tenant-one" });
  assert.deepEqual(
    records.map((record) => record.name),
    ["One"],
  );
  assert.throws(
    () =>
      collection.replaceOne(
        { tenantId: "tenant-one", _id: "one" },
        { _id: "one", tenantId: "tenant-two", name: "Moved" },
      ),
    /replacement tenantId must match/i,
  );
  assert.throws(
    () =>
      collection.findOneAndUpdate(
        { tenantId: "tenant-one", _id: "one" },
        { $set: { tenantId: "tenant-two" } },
      ),
    /tenantId cannot be changed/i,
  );
});
