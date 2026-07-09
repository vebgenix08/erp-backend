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
(0, node_test_1.default)("close enquiry sets closed status and closedAt", async () => {
    const repository = new enquiry_repository_1.InMemoryEnquiryRepository();
    const created = await (0, use_cases_1.createEnquiryUseCase)((0, fixtures_1.createEnquiryInput)(), (0, fixtures_1.createEnquiryServiceContext)(), { repository });
    const closed = await (0, use_cases_1.closeEnquiryUseCase)(String(created?.id ?? ""), (0, fixtures_1.createEnquiryServiceContext)(), { repository });
    strict_1.default.equal(closed?.status, "CLOSED");
    strict_1.default.ok(closed?.closedAt);
});
(0, node_test_1.default)("close enquiry is tenant isolated", async () => {
    const repository = new enquiry_repository_1.InMemoryEnquiryRepository();
    const created = await (0, use_cases_1.createEnquiryUseCase)((0, fixtures_1.createEnquiryInput)(), (0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_a" }), { repository });
    const result = await (0, use_cases_1.closeEnquiryUseCase)(String(created?.id ?? ""), (0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_b" }), { repository });
    strict_1.default.equal(result, null);
});
