"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const test_utils_1 = require("@school-erp/test-utils");
const academic_years_repository_1 = require("../academic-years.repository");
const use_cases_1 = require("../use-cases");
const fixtures_1 = require("./fixtures");
(0, node_test_1.default)("get academic year returns stored record", async () => {
    const repository = new academic_years_repository_1.InMemoryAcademicYearRepository();
    const context = (0, test_utils_1.createMockRequestContext)({
        tenantContext: { tenantId: "tenant-1" },
        authContext: {
            user: { id: "user-1", permissions: ["settings.academicyears.create", "settings.academicyears.read"] },
            source: "request",
            authenticatedAt: new Date(),
        },
    });
    const created = await (0, use_cases_1.createAcademicYearUseCase)(context, (0, fixtures_1.createAcademicYearFixture)(), { repository });
    const result = await (0, use_cases_1.getAcademicYearUseCase)(context, created.id, { repository });
    strict_1.default.equal(result?.code, "2025-26");
});
