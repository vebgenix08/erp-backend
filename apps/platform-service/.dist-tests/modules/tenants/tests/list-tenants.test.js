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
(0, node_test_1.default)("list tenants returns tenants sorted by name", async () => {
    const repository = new tenants_repository_1.InMemoryTenantRepository();
    await (0, use_cases_1.createTenantUseCase)((0, fixtures_1.createTenantFixture)({ name: "Zeta School", code: "ZETA" }), { repository });
    await (0, use_cases_1.createTenantUseCase)((0, fixtures_1.createTenantFixture)({ name: "Alpha College", code: "ALPHA", type: "COLLEGE" }), { repository });
    const tenants = await (0, use_cases_1.listTenantsUseCase)({ repository });
    strict_1.default.equal(tenants.length, 2);
    strict_1.default.equal(tenants[0]?.name, "Alpha College");
    strict_1.default.equal(tenants[1]?.name, "Zeta School");
});
