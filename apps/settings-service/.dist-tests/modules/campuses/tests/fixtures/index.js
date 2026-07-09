"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCampusFixture = createCampusFixture;
function createCampusFixture(overrides = {}) {
    return {
        code: "MAIN",
        name: "Main Campus",
        campusType: "SCHOOL",
        address: "Main Address",
        ...overrides,
    };
}
