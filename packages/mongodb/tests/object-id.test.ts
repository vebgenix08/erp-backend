import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { isObjectId, isObjectIdString, toObjectId, toObjectIdString, tryObjectId } from "../index";

test("object id helpers normalize valid ids", () => {
  const id = new ObjectId();
  assert.equal(isObjectId(id), true);
  assert.equal(isObjectIdString(id.toHexString()), true);
  assert.equal(toObjectIdString(id), id.toHexString());
  assert.equal(toObjectIdString(id.toHexString()), id.toHexString());
  assert.equal(tryObjectId(id)?.toHexString(), id.toHexString());
});

test("object id helpers reject invalid ids", () => {
  assert.throws(() => toObjectId("bad-id"), /invalid object id/i);
  assert.equal(tryObjectId("bad-id"), null);
});
