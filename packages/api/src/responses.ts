import { mapErrorToResponse } from "@school-erp/errors";
import type { ApiResponse } from "./types";

export function jsonResponse<TBody>(statusCode: number, body: TBody, headers: Record<string, string> = {}): ApiResponse<TBody> {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
    body,
  };
}

export function errorResponse(error: unknown): ApiResponse {
  const mapped = mapErrorToResponse(error);
  return jsonResponse(mapped.statusCode, mapped.body, {
    "x-error-code": mapped.body.error.code,
  });
}
