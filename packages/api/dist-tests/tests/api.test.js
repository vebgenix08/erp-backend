"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const errors_1 = require("@school-erp/errors");
const index_1 = require("../index");
(0, node_test_1.default)("createRequestContext normalizes request data", () => {
    const context = (0, index_1.createRequestContext)({
        requestId: "req-1",
        method: "post",
        path: " /tenants ",
        headers: { "X-Test": "yes" },
        query: { page: "1" },
        rawBody: "{\"name\":\"Alpha\"}",
    });
    strict_1.default.equal(context.requestId, "req-1");
    strict_1.default.equal(context.method, "POST");
    strict_1.default.equal(context.path, " /tenants ");
    strict_1.default.equal(context.headers["x-test"], "yes");
    strict_1.default.equal(context.query.page, "1");
    strict_1.default.deepEqual(context.body, { name: "Alpha" });
});
(0, node_test_1.default)("parseJsonBody rejects invalid JSON", () => {
    strict_1.default.throws(() => (0, index_1.parseJsonBody)("{"), /valid json/i);
});
(0, node_test_1.default)("jsonResponse and errorResponse return transport shapes", () => {
    const response = (0, index_1.jsonResponse)(200, { ok: true });
    strict_1.default.equal(response.statusCode, 200);
    strict_1.default.equal(response.headers?.["content-type"], "application/json; charset=utf-8");
    const error = (0, index_1.errorResponse)(new errors_1.ConflictError("duplicate"));
    strict_1.default.equal(error.statusCode, 409);
    strict_1.default.equal(error.body?.error?.code, "CONFLICT");
});
(0, node_test_1.default)("route matcher handles method and path registration", () => {
    const route = { method: "GET", path: "/tenants/:id", handler: async () => undefined, middlewares: [] };
    const match = (0, index_1.matchRoute)(route, "GET", "/tenants/tenant-1");
    strict_1.default.equal(match.matched, true);
    strict_1.default.equal(match.params.id, "tenant-1");
    strict_1.default.equal((0, index_1.normalizePath)("tenants/"), "/tenants");
});
(0, node_test_1.default)("router executes middleware in order", async () => {
    const order = [];
    const router = (0, index_1.createRouter)()
        .use(async (_context, next) => {
        order.push("global-1");
        const result = await next();
        order.push("global-1-after");
        return result;
    })
        .route("GET", "/ping", async () => {
        order.push("handler");
        return (0, index_1.jsonResponse)(200, { ok: true });
    }, {
        middlewares: [
            async (_context, next) => {
                order.push("route-1");
                const result = await next();
                order.push("route-1-after");
                return result;
            },
        ],
    });
    const response = await router.handle({ method: "GET", path: "/ping" });
    strict_1.default.equal(response.statusCode, 200);
    strict_1.default.deepEqual(order, ["global-1", "route-1", "handler", "route-1-after", "global-1-after"]);
});
(0, node_test_1.default)("auth and tenant middleware can populate request context", async () => {
    const router = new index_1.ApiRouter()
        .use((0, index_1.tenantMiddleware)())
        .use((0, index_1.authMiddleware)())
        .route("GET", "/secure", async (context) => {
        strict_1.default.equal(context.tenantContext?.tenantId, "tenant-1");
        strict_1.default.equal(context.authContext?.user?.id, "user-1");
        return (0, index_1.jsonResponse)(200, { ok: true });
    });
    const response = await router.handle({
        method: "GET",
        path: "/secure",
        headers: {
            "x-tenant-id": "tenant-1",
            "x-user-id": "user-1",
            "x-user-permissions": "platform.tenant.create",
        },
    });
    strict_1.default.equal(response.statusCode, 200);
});
(0, node_test_1.default)("validation middleware blocks bad input", async () => {
    const router = (0, index_1.createRouter)()
        .use((0, index_1.validationMiddleware)((context) => {
        if (typeof context.body !== "object" || context.body === null) {
            throw new errors_1.BadRequestError("body required");
        }
    }))
        .route("POST", "/items", async () => (0, index_1.jsonResponse)(201, { ok: true }));
    const response = await router.handle({ method: "POST", path: "/items", rawBody: "{}" });
    strict_1.default.equal(response.statusCode, 201);
});
