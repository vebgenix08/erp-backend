export interface AppErrorOptions {
  code?: string | undefined;
  details?: unknown;
  cause?: unknown;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: unknown;

  constructor(message: string, statusCode = 500, options: AppErrorOptions = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = options.code ?? "APP_ERROR";
    this.details = options.details;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", options: AppErrorOptions = {}) {
    super(message, 400, { ...options, code: options.code ?? "BAD_REQUEST" });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", options: AppErrorOptions = {}) {
    super(message, 401, { ...options, code: options.code ?? "UNAUTHORIZED" });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", options: AppErrorOptions = {}) {
    super(message, 403, { ...options, code: options.code ?? "FORBIDDEN" });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found", options: AppErrorOptions = {}) {
    super(message, 404, { ...options, code: options.code ?? "NOT_FOUND" });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", options: AppErrorOptions = {}) {
    super(message, 409, { ...options, code: options.code ?? "CONFLICT" });
  }
}

export interface ValidationErrorDetails {
  fields: Array<{ field: string; message: string }>;
}

export class ValidationError extends BadRequestError {
  readonly details: ValidationErrorDetails;

  constructor(fields: ValidationErrorDetails["fields"], message = "Validation failed") {
    super(message, { code: "VALIDATION_ERROR", details: { fields } });
    this.details = { fields };
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
