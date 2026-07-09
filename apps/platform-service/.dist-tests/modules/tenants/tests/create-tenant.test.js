"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const tenants_repository_1 = require("../tenants.repository");
const use_cases_1 = require("../use-cases");
const fixtures_1 = require("./fixtures");
(0, node_test_1.default)("create tenant stores an active tenant and enforces required fields", async () => {
    const repository = new tenants_repository_1.InMemoryTenantRepository();
    const result = await (0, use_cases_1.createTenantUseCase)((0, fixtures_1.createTenantFixture)(), { repository });
    strict_1.default.equal(result?.name, "Sample School");
    strict_1.default.equal(result?.code, "SAMPLE-SCHOOL");
    strict_1.default.equal(result?.status, "ACTIVE");
    strict_1.default.equal(result?.type, "SCHOOL");
    strict_1.default.ok(result?.createdAt);
    strict_1.default.ok(result?.updatedAt);
});
(0, node_test_1.default)("create tenant rejects duplicate code", async () => {
    const repository = new tenants_repository_1.InMemoryTenantRepository();
    const duplicate = (0, fixtures_1.createTenantFixture)({ code: "DUP" });
    await (0, use_cases_1.createTenantUseCase)(duplicate, { repository });
    await strict_1.default.rejects(() => (0, use_cases_1.createTenantUseCase)((0, fixtures_1.createTenantFixture)({ name: "Two", code: "DUP", type: "COLLEGE" }), { repository }), /tenant code must be unique/i);
});
