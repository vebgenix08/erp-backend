import type { AuthContext } from "@school-erp/auth";
import type { TenantContext } from "@school-erp/tenancy";

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

export type ApiHeaders = Record<string, string | string[] | undefined>;
export type ApiQuery = Record<string, string | string[] | undefined>;
export type ApiBody = unknown;

export interface ApiRequest {
  requestId?: string | undefined;
  method: string;
  path: string;
  headers?: ApiHeaders | undefined;
  query?: ApiQuery | undefined;
  body?: ApiBody | undefined;
  rawBody?: string | undefined;
  tenantContext?: TenantContext | undefined;
  authContext?: AuthContext | undefined;
}

export interface ApiResponse<TBody = unknown> {
  statusCode: number;
  headers?: ApiHeaders | undefined;
  body?: TBody | undefined;
}

export interface RequestContext {
  requestId: string;
  tenantContext?: TenantContext | undefined;
  authContext?: AuthContext | undefined;
  path: string;
  method: ApiMethod;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
  body: ApiBody;
  params: Record<string, string>;
}

export type ApiNext = () => Promise<ApiResponse | void>;
export type ApiMiddleware = (context: RequestContext, next: ApiNext) => Promise<ApiResponse | void>;
export type ApiHandler = (context: RequestContext) => Promise<ApiResponse | void> | ApiResponse | void;

export interface RouteMatch {
  method: ApiMethod;
  path: string;
  handler: ApiHandler;
  middlewares: ApiMiddleware[];
}

export interface CreateRequestContextOptions {
  requestId?: string | undefined;
  defaultMethod?: ApiMethod | undefined;
}

export interface RouteRegistrationOptions {
  middlewares?: ApiMiddleware[] | undefined;
}
