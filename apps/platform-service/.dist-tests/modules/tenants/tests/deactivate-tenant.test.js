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
(0, node_test_1.default)("deactivate tenant marks the tenant inactive with a deactivated timestamp", async () => {
    const repository = new tenants_repository_1.InMemoryTenantRepository();
    const created = await (0, use_cases_1.createTenantUseCase)((0, fixtures_1.createTenantFixture)({ name: "Dormant School", code: "DORMANT" }), { repository });
    const deactivated = await (0, use_cases_1.deactivateTenantUseCase)(String(created?.id ?? ""), { repository });
    strict_1.default.equal(deactivated?.status, "INACTIVE");
    strict_1.default.ok(deactivated?.deactivatedAt);
});
