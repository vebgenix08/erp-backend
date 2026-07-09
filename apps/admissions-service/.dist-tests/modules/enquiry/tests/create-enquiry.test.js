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
(0, node_test_1.default)("create enquiry stores a tenant-scoped enquiry with a generated enquiry number", async () => {
    const repository = new enquiry_repository_1.InMemoryEnquiryRepository();
    const context = (0, fixtures_1.createEnquiryServiceContext)();
    const result = await (0, use_cases_1.createEnquiryUseCase)((0, fixtures_1.createEnquiryInput)(), context, { repository });
    strict_1.default.equal(result?.tenantId, "tenant_test_1");
    strict_1.default.equal(result?.status, "NEW");
    strict_1.default.equal(result?.createdBy, "user_test_1");
    strict_1.default.match(result?.enquiryNumber ?? "", /^ENQ-\d{4}$/);
});
(0, node_test_1.default)("create enquiry generates numbers per tenant", async () => {
    const repository = new enquiry_repository_1.InMemoryEnquiryRepository();
    const first = await (0, use_cases_1.createEnquiryUseCase)((0, fixtures_1.createEnquiryInput)({ studentName: "One" }), (0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_a" }), { repository });
    const second = await (0, use_cases_1.createEnquiryUseCase)((0, fixtures_1.createEnquiryInput)({ studentName: "Two" }), (0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_a" }), { repository });
    const otherTenant = await (0, use_cases_1.createEnquiryUseCase)((0, fixtures_1.createEnquiryInput)({ studentName: "Three" }), (0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_b" }), { repository });
    strict_1.default.equal(first?.enquiryNumber, "ENQ-0001");
    strict_1.default.equal(second?.enquiryNumber, "ENQ-0002");
    strict_1.default.equal(otherTenant?.enquiryNumber, "ENQ-0001");
});
(0, node_test_1.default)("create enquiry ignores tenantId in the request body", async () => {
    const repository = new enquiry_repository_1.InMemoryEnquiryRepository();
    const result = await (0, use_cases_1.createEnquiryUseCase)((0, fixtures_1.createEnquiryInput)({ tenantId: "body_tenant_should_be_ignored" }), (0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_context_wins" }), { repository });
    strict_1.default.equal(result?.tenantId, "tenant_context_wins");
});
