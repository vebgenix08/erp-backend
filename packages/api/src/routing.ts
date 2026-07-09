import { NotFoundError } from "@school-erp/errors";
import type { ApiHandler, ApiMethod, ApiMiddleware, ApiResponse, ApiRequest, RequestContext, RouteMatch, RouteRegistrationOptions } from "./types";
import { createRequestContext, parseJsonBody } from "./request";
import { errorResponse } from "./responses";

type RouteParams = Record<string, string>;

function splitPath(path: string): string[] {
  return path.split("/").filter(Boolean);
}

function isPathParam(segment: string): boolean {
  return segment.startsWith(":") && segment.length > 1;
}

function matchPath(pattern: string, actual: string): { matched: boolean; params: RouteParams } {
  const patternSegments = splitPath(pattern);
  const actualSegments = splitPath(actual);
  if (patternSegments.length !== actualSegments.length) {
    return { matched: false, params: {} };
  }

  const params: RouteParams = {};
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

export function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  const trimmed = path.trim();
  if (!trimmed.startsWith("/")) {
    return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
  }
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

export function matchRoute(route: RouteMatch, method: ApiMethod, path: string) {
  if (route.method !== method) {
    return { matched: false, params: {} as RouteParams };
  }
  return matchPath(normalizePath(route.path), normalizePath(path));
}

async function executeMiddlewareChain(
  middlewares: ApiMiddleware[],
  context: RequestContext,
  handler: ApiHandler,
): Promise<ApiResponse> {
  let index = -1;

  const dispatch = async (currentIndex: number): Promise<ApiResponse | void> => {
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

function jsonNoContent(): ApiResponse {
  return { statusCode: 204, headers: { "content-type": "application/json; charset=utf-8" } };
}

export class ApiRouter {
  private readonly routes: RouteMatch[] = [];
  private readonly middlewares: ApiMiddleware[] = [];

  use(middleware: ApiMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  route(method: ApiMethod, path: string, handler: ApiHandler, options: RouteRegistrationOptions = {}): this {
    this.routes.push({
      method,
      path: normalizePath(path),
      handler,
      middlewares: options.middlewares ?? [],
    });
    return this;
  }

  async handle(request: ApiRequest): Promise<ApiResponse> {
    try {
      const context = createRequestContext(request);
      const matched = this.routes
        .map((candidate) => ({ route: candidate, match: matchRoute(candidate, context.method, context.path) }))
        .find((candidate) => candidate.match.matched);
      const route = matched?.route;
      if (!route) {
        throw new NotFoundError(`No route for ${context.method} ${context.path}`);
      }
      context.params = matched?.match.params ?? {};
      return await executeMiddlewareChain([...this.middlewares, ...route.middlewares], context, route.handler);
    } catch (error) {
      return errorResponse(error);
    }
  }
}

export function createRouter(): ApiRouter {
  return new ApiRouter();
}

export function withRouteParams(route: RouteMatch, method: ApiMethod, path: string) {
  return matchRoute(route, method, path);
}

export function parseBodyForRoute(request: ApiRequest) {
  if (request.body !== undefined) {
    return request.body;
  }
  return parseJsonBody(request.rawBody);
}
