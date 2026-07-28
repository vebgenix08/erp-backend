import { AppError, isAppError } from "./app-error";

export interface ErrorResponsePayload {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    traceId: string;
    details?: unknown;
  };
}

export interface ErrorResponseBody {
  statusCode: number;
  body: ErrorResponsePayload;
}

export type ErrorResponse = ErrorResponseBody;

const transientFailure = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const candidate = error as Error & {
    name?: string;
    code?: string;
    statusCode?: number;
    $metadata?: { httpStatusCode?: number };
  };
  const status = candidate.statusCode ?? candidate.$metadata?.httpStatusCode;
  return (
    status === 429 ||
    candidate.name === "TooManyRequestsException" ||
    candidate.code === "TooManyRequestsException" ||
    /throttl|too many requests|connection pool|temporarily unavailable/i.test(
      candidate.message,
    )
  );
};

const createTraceId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export function toErrorResponse(error: unknown, traceId = createTraceId()): ErrorResponse {
  if (isAppError(error)) {
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          retryable: false,
          traceId,
          details: error.details,
        },
      },
    };
  }

  if (transientFailure(error)) {
    return {
      statusCode: 503,
      body: {
        error: {
          code: "SERVICE_BUSY",
          message: "The service is temporarily busy.",
          retryable: true,
          traceId,
        },
      },
    };
  }

  return {
    statusCode: 500,
    body: {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "The request could not be completed.",
          retryable: false,
          traceId,
        },
      },
  };
}

export const mapErrorToResponse = toErrorResponse;

export function toGraphqlError(error: unknown, traceId?: string): Error {
  const mapped = toErrorResponse(error, traceId);
  const result = new Error(mapped.body.error.message);
  result.name = mapped.body.error.code;
  Object.assign(result, {
    extensions: {
      code: mapped.body.error.code,
      retryable: mapped.body.error.retryable,
      traceId: mapped.body.error.traceId,
    },
  });
  return result;
}
