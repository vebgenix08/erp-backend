"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const fixtures_1 = require("./fixtures");
const session_repository_1 = require("../session.repository");
const use_cases_1 = require("../use-cases");
(0, node_test_1.default)("select tenant persists the selected tenant", async () => {
    const repository = new session_repository_1.InMemorySessionRepository();
    const context = (0, fixtures_1.createSessionContext)();
    const result = await (0, use_cases_1.selectTenantUseCase)({ tenantId: "tenant_x" }, context, { repository });
    strict_1.default.equal(result.selectedTenant?.tenantId, "tenant_x");
});
