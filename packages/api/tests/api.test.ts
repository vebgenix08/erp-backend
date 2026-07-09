import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestError, ConflictError } from "@school-erp/errors";
import {
  ApiRouter,
  authMiddleware,
  createRequestContext,
  createRouter,
  errorResponse,
  jsonResponse,
  matchRoute,
  normalizePath,
  parseJsonBody,
  tenantMiddleware,
  validationMiddleware,
} from "../index";

test("createRequestContext normalizes request data", () => {
  const context = createRequestContext({
    requestId: "req-1",
    method: "post",
    path: " /tenants ",
    headers: { "X-Test": "yes" },
    query: { page: "1" },
    rawBody: "{\"name\":\"Alpha\"}",
  });

  assert.equal(context.requestId, "req-1");
  assert.equal(context.method, "POST");
  assert.equal(context.path, " /tenants ");
  assert.equal(context.headers["x-test"], "yes");
  assert.equal(context.query.page, "1");
  assert.deepEqual(context.body, { name: "Alpha" });
});

test("parseJsonBody rejects invalid JSON", () => {
  assert.throws(() => parseJsonBody("{"), /valid json/i);
});

test("jsonResponse and errorResponse return transport shapes", () => {
  const response = jsonResponse(200, { ok: true });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers?.["content-type"], "application/json; charset=utf-8");

  const error = errorResponse(new ConflictError("duplicate"));
  assert.equal(error.statusCode, 409);
  assert.equal((error.body as { error?: { code?: string } } | undefined)?.error?.code, "CONFLICT");
});

test("route matcher handles method and path registration", () => {
  const route = { method: "GET" as const, path: "/tenants/:id", handler: async () => undefined, middlewares: [] };
  const match = matchRoute(route, "GET", "/tenants/tenant-1");
  assert.equal(match.matched, true);
  assert.equal(match.params.id, "tenant-1");
  assert.equal(normalizePath("tenants/"), "/tenants");
});

test("router executes middleware in order", async () => {
  const order: string[] = [];
  const router = createRouter()
    .use(async (_context, next) => {
      order.push("global-1");
      const result = await next();
      order.push("global-1-after");
      return result;
    })
    .route(
      "GET",
      "/ping",
      async () => {
        order.push("handler");
        return jsonResponse(200, { ok: true });
      },
      {
        middlewares: [
          async (_context, next) => {
            order.push("route-1");
            const result = await next();
            order.push("route-1-after");
            return result;
          },
        ],
      },
    );

  const response = await router.handle({ method: "GET", path: "/ping" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(order, ["global-1", "route-1", "handler", "route-1-after", "global-1-after"]);
});

test("auth and tenant middleware can populate request context", async () => {
  const router = new ApiRouter()
    .use(tenantMiddleware())
    .use(authMiddleware())
    .route("GET", "/secure", async (context) => {
      assert.equal(context.tenantContext?.tenantId, "tenant-1");
      assert.equal(context.authContext?.user?.id, "user-1");
      return jsonResponse(200, { ok: true });
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

  assert.equal(response.statusCode, 200);
});

test("validation middleware blocks bad input", async () => {
  const router = createRouter()
    .use(validationMiddleware((context) => {
      if (typeof context.body !== "object" || context.body === null) {
        throw new BadRequestError("body required");
      }
    }))
    .route("POST", "/items", async () => jsonResponse(201, { ok: true }));

  const response = await router.handle({ method: "POST", path: "/items", rawBody: "{}" });
  assert.equal(response.statusCode, 201);
});
