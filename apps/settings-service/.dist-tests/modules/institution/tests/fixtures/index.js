"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInstitutionFixture = createInstitutionFixture;
function createInstitutionFixture(overrides = {}) {
    return {
        name: "Sample Institution",
        shortName: "Sample",
        contactEmail: "admin@sample.test",
        contactPhone: "+1 555 0100",
        address: "Sample Address",
        logoUrl: "https://example.com/logo.png",
        ...overrides,
    };
}
