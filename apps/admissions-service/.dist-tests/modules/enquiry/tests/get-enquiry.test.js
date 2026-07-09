"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const enquiry_repository_1 = require("../enquiry.repository");
const use_cases_1 = require("../use-cases");
const fixtures_1 = require("./fixtures");
(0, node_test_1.default)("get enquiry returns only the enquiry within the tenant", async () => {
    const repository = new enquiry_repository_1.InMemoryEnquiryRepository();
    const created = await (0, use_cases_1.createEnquiryUseCase)((0, fixtures_1.createEnquiryInput)({ studentName: "Alice" }), (0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_a" }), { repository });
    await (0, use_cases_1.createEnquiryUseCase)((0, fixtures_1.createEnquiryInput)({ studentName: "Bob" }), (0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_b" }), { repository });
    const found = await (0, use_cases_1.getEnquiryUseCase)(String(created?.id ?? ""), (0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_a" }), { repository });
    const missing = await (0, use_cases_1.getEnquiryUseCase)(String(created?.id ?? ""), (0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_b" }), { repository });
    strict_1.default.equal(found?.studentName, "Alice");
    strict_1.default.equal(missing, null);
});
