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
(0, node_test_1.default)("get tenant returns the stored tenant view", async () => {
    const repository = new tenants_repository_1.InMemoryTenantRepository();
    const created = await (0, use_cases_1.createTenantUseCase)((0, fixtures_1.createTenantFixture)({ name: "City College", code: "CITY", type: "COLLEGE" }), { repository });
    const found = await (0, use_cases_1.getTenantUseCase)(String(created?.id ?? ""), { repository });
    strict_1.default.equal(found?.name, "City College");
    strict_1.default.equal(found?.code, "CITY");
    strict_1.default.equal(found?.type, "COLLEGE");
});
