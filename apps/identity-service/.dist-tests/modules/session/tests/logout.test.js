"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const fixtures_1 = require("./fixtures");
const use_cases_1 = require("../use-cases");
(0, node_test_1.default)("logout returns success", async () => {
    const result = await (0, use_cases_1.logoutUseCase)((0, fixtures_1.createSessionContext)());
    strict_1.default.equal(result.success, true);
});
