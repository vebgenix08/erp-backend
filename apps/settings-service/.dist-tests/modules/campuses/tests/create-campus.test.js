"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const test_utils_1 = require("@school-erp/test-utils");
const campuses_repository_1 = require("../campuses.repository");
const use_cases_1 = require("../use-cases");
const fixtures_1 = require("./fixtures");
(0, node_test_1.default)("create campus stores a tenant-scoped campus", async () => {
    const repository = new campuses_repository_1.InMemoryCampusRepository();
    const context = (0, test_utils_1.createMockRequestContext)({
        tenantContext: { tenantId: "tenant-1" },
        authContext: {
            user: { id: "user-1", permissions: ["settings.campuses.create"] },
            source: "request",
            authenticatedAt: new Date(),
        },
    });
    const result = await (0, use_cases_1.createCampusUseCase)(context, (0, fixtures_1.createCampusFixture)(), { repository });
    strict_1.default.equal(result.name, "Main Campus");
    strict_1.default.equal(result.status, "ACTIVE");
});
