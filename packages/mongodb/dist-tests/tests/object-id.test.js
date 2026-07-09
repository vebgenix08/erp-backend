"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const mongodb_1 = require("mongodb");
const index_1 = require("../index");
(0, node_test_1.default)("object id helpers normalize valid ids", () => {
    const id = new mongodb_1.ObjectId();
    strict_1.default.equal((0, index_1.isObjectId)(id), true);
    strict_1.default.equal((0, index_1.isObjectIdString)(id.toHexString()), true);
    strict_1.default.equal((0, index_1.toObjectIdString)(id), id.toHexString());
    strict_1.default.equal((0, index_1.toObjectIdString)(id.toHexString()), id.toHexString());
    strict_1.default.equal((0, index_1.tryObjectId)(id)?.toHexString(), id.toHexString());
});
(0, node_test_1.default)("object id helpers reject invalid ids", () => {
    strict_1.default.throws(() => (0, index_1.toObjectId)("bad-id"), /invalid object id/i);
    strict_1.default.equal((0, index_1.tryObjectId)("bad-id"), null);
});
