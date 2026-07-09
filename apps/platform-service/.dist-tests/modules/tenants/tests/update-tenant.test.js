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
(0, node_test_1.default)("update tenant changes mutable fields", async () => {
    const repository = new tenants_repository_1.InMemoryTenantRepository();
    const created = await (0, use_cases_1.createTenantUseCase)((0, fixtures_1.createTenantFixture)({ name: "Old Name", code: "OLD" }), { repository });
    const updated = await (0, use_cases_1.updateTenantUseCase)(String(created?.id ?? ""), { name: "New Name" }, { repository });
    strict_1.default.equal(updated?.name, "New Name");
    strict_1.default.equal(updated?.code, "OLD");
});
(0, node_test_1.default)("update tenant rejects duplicate code", async () => {
    const repository = new tenants_repository_1.InMemoryTenantRepository();
    const first = await (0, use_cases_1.createTenantUseCase)((0, fixtures_1.createTenantFixture)({ name: "First", code: "FIRST" }), { repository });
    await (0, use_cases_1.createTenantUseCase)((0, fixtures_1.createTenantFixture)({ name: "Second", code: "SECOND", type: "COLLEGE" }), { repository });
    await strict_1.default.rejects(() => (0, use_cases_1.updateTenantUseCase)(String(first?.id ?? ""), { code: "SECOND" }, { repository }), /tenant code must be unique/i);
});
