import { BadRequestError } from "@school-erp/errors";
import type { CognitoSyncCreateInput, CognitoSyncListFilter, CognitoSyncUpdateInput, CognitoSyncStatus } from "./cognito-sync.model";

const allowedStatuses: CognitoSyncStatus[] = ["PENDING", "SYNCED", "FAILED", "DISABLED"];

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateCognitoSyncCreateInput(input: unknown): CognitoSyncCreateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("cognito sync input is required");
  }
  const value = input as Record<string, unknown>;
  const userId = asTrimmedString(value.userId);
  const email = asTrimmedString(value.email);
  const cognitoUsername = asTrimmedString(value.cognitoUsername);

  if (!userId) {
    throw new BadRequestError("userId is required");
  }
  if (!email) {
    throw new BadRequestError("email is required");
  }
  if (!email.includes("@")) {
    throw new BadRequestError("valid email is required");
  }

  return {
    userId,
    email,
    cognitoUsername: cognitoUsername || undefined,
  };
}

export function validateCognitoSyncUpdateInput(input: unknown): CognitoSyncUpdateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("cognito sync update is required");
  }
  const value = input as Record<string, unknown>;
  const update: CognitoSyncUpdateInput = {};

  if (value.cognitoUsername !== undefined) {
    const cognitoUsername = asTrimmedString(value.cognitoUsername);
    if (!cognitoUsername) {
      throw new BadRequestError("cognitoUsername cannot be empty");
    }
    update.cognitoUsername = cognitoUsername;
  }
  if (value.status !== undefined) {
    const status = asTrimmedString(value.status).toUpperCase();
    if (!allowedStatuses.includes(status as CognitoSyncStatus)) {
      throw new BadRequestError("invalid cognito sync status");
    }
    update.status = status as CognitoSyncStatus;
  }
  if (value.errorMessage !== undefined) {
    const errorMessage = asTrimmedString(value.errorMessage);
    update.errorMessage = errorMessage || undefined;
  }
  return update;
}

export function validateCognitoSyncListFilter(input: unknown): CognitoSyncListFilter {
  if (input === undefined || input === null) {
    return {};
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("cognito sync filter must be an object");
  }
  const value = input as Record<string, unknown>;
  const filter: CognitoSyncListFilter = {};
  const search = asTrimmedString(value.search);
  const status = asTrimmedString(value.status).toUpperCase();
  if (search) filter.search = search;
  if (status) {
    if (!allowedStatuses.includes(status as CognitoSyncStatus)) {
      throw new BadRequestError("invalid cognito sync status");
    }
    filter.status = status as CognitoSyncStatus;
  }
  return filter;
}
