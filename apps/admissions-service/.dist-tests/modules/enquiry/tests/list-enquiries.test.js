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
(0, node_test_1.default)("list enquiries returns only tenant enquiries in creation order", async () => {
    const repository = new enquiry_repository_1.InMemoryEnquiryRepository();
    await (0, use_cases_1.createEnquiryUseCase)((0, fixtures_1.createEnquiryInput)({ studentName: "Alpha" }), (0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_a" }), { repository });
    await (0, use_cases_1.createEnquiryUseCase)((0, fixtures_1.createEnquiryInput)({ studentName: "Beta" }), (0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_a" }), { repository });
    await (0, use_cases_1.createEnquiryUseCase)((0, fixtures_1.createEnquiryInput)({ studentName: "Gamma" }), (0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_b" }), { repository });
    const list = await (0, use_cases_1.listEnquiriesUseCase)((0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_a" }), { repository });
    strict_1.default.equal(list.length, 2);
    strict_1.default.equal(list[0]?.studentName, "Alpha");
    strict_1.default.equal(list[1]?.studentName, "Beta");
});
(0, node_test_1.default)("list enquiries supports status, source, and search filters", async () => {
    const repository = new enquiry_repository_1.InMemoryEnquiryRepository();
    const created = await (0, use_cases_1.createEnquiryUseCase)((0, fixtures_1.createEnquiryInput)({ studentName: "Filter Match", source: "Walk-In" }), (0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_a" }), { repository });
    await (0, use_cases_1.createEnquiryUseCase)((0, fixtures_1.createEnquiryInput)({ studentName: "Other Match", source: "Referral" }), (0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_a" }), { repository });
    await (0, use_cases_1.updateEnquiryUseCase)(String(created?.id ?? ""), { status: "CONTACTED" }, (0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_a" }), { repository });
    const closedRecord = await (0, use_cases_1.createEnquiryUseCase)((0, fixtures_1.createEnquiryInput)({ studentName: "Closed Match", source: "Walk-In" }), (0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_a" }), { repository });
    await (0, use_cases_1.closeEnquiryUseCase)(String(closedRecord?.id ?? ""), (0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_a" }), { repository });
    const byStatus = await (0, use_cases_1.listEnquiriesUseCase)((0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_a" }), { repository }, { status: "CONTACTED" });
    const bySource = await (0, use_cases_1.listEnquiriesUseCase)((0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_a" }), { repository }, { source: "walk-in" });
    const bySearch = await (0, use_cases_1.listEnquiriesUseCase)((0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_a" }), { repository }, { search: "filter" });
    const byClosedStatus = await (0, use_cases_1.listEnquiriesUseCase)((0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_a" }), { repository }, { status: "CLOSED" });
    strict_1.default.equal(byStatus.length, 1);
    strict_1.default.equal(byStatus[0]?.studentName, "Filter Match");
    strict_1.default.equal(bySource.length, 2);
    strict_1.default.equal(bySearch.length, 1);
    strict_1.default.equal(bySearch[0]?.studentName, "Filter Match");
    strict_1.default.equal(byClosedStatus.length, 1);
    strict_1.default.equal(byClosedStatus[0]?.status, "CLOSED");
});
