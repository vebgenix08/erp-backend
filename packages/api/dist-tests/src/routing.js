"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiRouter = void 0;
exports.normalizePath = normalizePath;
exports.matchRoute = matchRoute;
exports.createRouter = createRouter;
exports.withRouteParams = withRouteParams;
exports.parseBodyForRoute = parseBodyForRoute;
const errors_1 = require("@school-erp/errors");
const request_1 = require("./request");
const responses_1 = require("./responses");
function splitPath(path) {
    return path.split("/").filter(Boolean);
}
function isPathParam(segment) {
    return segment.startsWith(":") && segment.length > 1;
}
function matchPath(pattern, actual) {
    const patternSegments = splitPath(pattern);
    const actualSegments = splitPath(actual);
    if (patternSegments.length !== actualSegments.length) {
        return { matched: false, params: {} };
    }
    const params = {};
    for (let index = 0; index < patternSegments.length; index += 1) {
        const patternSegment = patternSegments[index] ?? "";
        const actualSegment = actualSegments[index] ?? "";
        if (isPathParam(patternSegment)) {
            params[patternSegment.slice(1)] = decodeURIComponent(actualSegment);
            continue;
        }
        if (patternSegment !== actualSegment) {
            return { matched: false, params: {} };
        }
    }
    return { matched: true, params };
}
function normalizePath(path) {
    if (!path || path === "/")
        return "/";
    const trimmed = path.trim();
    if (!trimmed.startsWith("/")) {
        return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
    }
    return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}
function matchRoute(route, method, path) {
    if (route.method !== method) {
        return { matched: false, params: {} };
    }
    return matchPath(normalizePath(route.path), normalizePath(path));
}
async function executeMiddlewareChain(middlewares, context, handler) {
    let index = -1;
    const dispatch = async (currentIndex) => {
        if (currentIndex <= index) {
            throw new Error("next() called multiple times");
        }
        index = currentIndex;
        const middleware = middlewares[currentIndex];
        if (middleware) {
            return middleware(context, () => dispatch(currentIndex + 1));
        }
        return handler(context);
    };
    const result = await dispatch(0);
    if (!result) {
        return jsonNoContent();
    }
    return result;
}
function jsonNoContent() {
    return { statusCode: 204, headers: { "content-type": "application/json; charset=utf-8" } };
}
class ApiRouter {
    routes = [];
    middlewares = [];
    use(middleware) {
        this.middlewares.push(middleware);
        return this;
    }
    route(method, path, handler, options = {}) {
        this.routes.push({
            method,
            path: normalizePath(path),
            handler,
            middlewares: options.middlewares ?? [],
        });
        return this;
    }
    async handle(request) {
        try {
            const context = (0, request_1.createRequestContext)(request);
            const matched = this.routes
                .map((candidate) => ({ route: candidate, match: matchRoute(candidate, context.method, context.path) }))
                .find((candidate) => candidate.match.matched);
            const route = matched?.route;
            if (!route) {
                throw new errors_1.NotFoundError(`No route for ${context.method} ${context.path}`);
            }
            context.params = matched?.match.params ?? {};
            return await executeMiddlewareChain([...this.middlewares, ...route.middlewares], context, route.handler);
        }
        catch (error) {
            return (0, responses_1.errorResponse)(error);
        }
    }
}
exports.ApiRouter = ApiRouter;
function createRouter() {
    return new ApiRouter();
}
function withRouteParams(route, method, path) {
    return matchRoute(route, method, path);
}
function parseBodyForRoute(request) {
    if (request.body !== undefined) {
        return request.body;
    }
    return (0, request_1.parseJsonBody)(request.rawBody);
}
