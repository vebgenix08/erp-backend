"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const errors_1 = require("@school-erp/errors");
const enquiry_repository_1 = require("../enquiry.repository");
const use_cases_1 = require("../use-cases");
const fixtures_1 = require("./fixtures");
(0, node_test_1.default)("update enquiry modifies fields only within the tenant", async () => {
    const repository = new enquiry_repository_1.InMemoryEnquiryRepository();
    const created = await (0, use_cases_1.createEnquiryUseCase)((0, fixtures_1.createEnquiryInput)({ studentName: "Old Name" }), (0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_a" }), { repository });
    const updated = await (0, use_cases_1.updateEnquiryUseCase)(String(created?.id ?? ""), { studentName: "New Name", status: "CONTACTED" }, (0, fixtures_1.createEnquiryServiceContext)({ tenantId: "tenant_a" }), { repository });
    strict_1.default.equal(updated?.studentName, "New Name");
    strict_1.default.equal(updated?.status, "CONTACTED");
});
(0, node_test_1.default)("update enquiry rejects closed status", async () => {
    const repository = new enquiry_repository_1.InMemoryEnquiryRepository();
    const created = await (0, use_cases_1.createEnquiryUseCase)((0, fixtures_1.createEnquiryInput)(), (0, fixtures_1.createEnquiryServiceContext)(), { repository });
    await strict_1.default.rejects(() => (0, use_cases_1.updateEnquiryUseCase)(String(created?.id ?? ""), { status: "CLOSED" }, (0, fixtures_1.createEnquiryServiceContext)(), { repository }), errors_1.ValidationError);
});
