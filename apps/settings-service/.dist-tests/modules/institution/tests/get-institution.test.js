"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const test_utils_1 = require("@school-erp/test-utils");
const fixtures_1 = require("./fixtures");
const institution_repository_1 = require("../institution.repository");
const use_cases_1 = require("../use-cases");
(0, node_test_1.default)("get institution returns the stored profile", async () => {
    const repository = new institution_repository_1.InMemoryInstitutionRepository();
    const context = (0, test_utils_1.createMockRequestContext)({
        tenantContext: { tenantId: "tenant-1" },
        authContext: {
            user: { id: "user-1", permissions: ["settings.institution.read", "settings.institution.update"] },
            source: "request",
            authenticatedAt: new Date(),
        },
    });
    await (0, use_cases_1.updateInstitutionUseCase)((0, fixtures_1.createInstitutionFixture)(), context, { repository });
    const result = await (0, use_cases_1.getInstitutionUseCase)(context, { repository });
    strict_1.default.equal(result?.name, "Sample Institution");
});
