import { AppError, isAppError } from "./app-error";

export interface ErrorResponsePayload {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ErrorResponseBody {
  statusCode: number;
  body: ErrorResponsePayload;
}

export type ErrorResponse = ErrorResponseBody;

export function toErrorResponse(error: unknown): ErrorResponse {
  if (isAppError(error)) {
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
    };
  }

  if (error instanceof Error) {
    return {
      statusCode: 500,
      body: {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Internal server error",
        },
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      },
    },
  };
}

export const mapErrorToResponse = toErrorResponse;
