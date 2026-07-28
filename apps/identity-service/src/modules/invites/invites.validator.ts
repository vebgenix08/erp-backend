import { BadRequestError } from "@school-erp/errors";
import type { InviteCreateInput, InviteListFilter, InviteUpdateInput, InviteStatus } from "./invites.model";

const allowedStatuses: InviteStatus[] = ["PENDING", "SENT", "ACCEPTED", "REVOKED", "EXPIRED"];

function toTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function assertNoTenantId(input: Record<string, unknown>): void {
  if (input.tenantId !== undefined && input.tenantId !== null && toTrimmedString(input.tenantId)) {
    throw new BadRequestError("tenantId must not be provided in invite body");
  }
}

export function validateInviteCreateInput(input: unknown): InviteCreateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("invite input is required");
  }
  const value = input as Record<string, unknown>;
  assertNoTenantId(value);

  const email = toTrimmedString(value.email);
  const role = toTrimmedString(value.role);
  const fullName = toTrimmedString(value.fullName);
  const message = toTrimmedString(value.message);
  const expiresInDaysRaw = value.expiresInDays;

  if (!email) {
    throw new BadRequestError("email is required");
  }
  if (!email.includes("@")) {
    throw new BadRequestError("valid email is required");
  }
  if (!role) {
    throw new BadRequestError("role is required");
  }

  let expiresInDays: number | undefined;
  if (expiresInDaysRaw !== undefined) {
    if (typeof expiresInDaysRaw !== "number" || !Number.isFinite(expiresInDaysRaw) || expiresInDaysRaw <= 0) {
      throw new BadRequestError("expiresInDays must be a positive number");
    }
    expiresInDays = Math.floor(expiresInDaysRaw);
  }

  return {
    email,
    role,
    fullName: fullName || undefined,
    expiresInDays,
    message: message || undefined,
  };
}

export function validateInviteUpdateInput(input: unknown): InviteUpdateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("invite update input is required");
  }
  const value = input as Record<string, unknown>;
  assertNoTenantId(value);

  const update: InviteUpdateInput = {};
  if (value.fullName !== undefined) {
    const fullName = toTrimmedString(value.fullName);
    if (!fullName) {
      throw new BadRequestError("fullName cannot be empty");
    }
    update.fullName = fullName;
  }
  if (value.role !== undefined) {
    const role = toTrimmedString(value.role);
    if (!role) {
      throw new BadRequestError("role cannot be empty");
    }
    update.role = role;
  }
  return update;
}

export function validateInviteListFilter(input: unknown): InviteListFilter {
  if (input === undefined || input === null) {
    return {};
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("invite filter must be an object");
  }
  const value = input as Record<string, unknown>;
  const filter: InviteListFilter = {};
  const search = toTrimmedString(value.search);
  const role = toTrimmedString(value.role);
  const status = toTrimmedString(value.status).toUpperCase();

  if (search) {
    filter.search = search;
  }
  if (role) {
    filter.role = role;
  }
  if (status) {
    if (!allowedStatuses.includes(status as InviteStatus)) {
      throw new BadRequestError("invalid invite status");
    }
    filter.status = status as InviteStatus;
  }
  return filter;
}
