import test from "node:test";
import assert from "node:assert/strict";
import { getCollectionFromDb } from "../index";

test("getCollectionFromDb returns a named collection adapter from a db", () => {
  const db = {
    collection(name: string) {
      return { collectionName: name };
    },
  } as never;

  const collection = getCollectionFromDb(db, "students");
  assert.equal(collection.collectionName, "students");
});
