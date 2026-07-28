import { BadRequestError } from "@school-erp/errors";
import type { FeatureFlagCreateInput, FeatureFlagStatus, FeatureFlagUpdateInput } from "./feature-flags.model";

const allowedStatuses: FeatureFlagStatus[] = ["ACTIVE", "INACTIVE"];

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateFeatureFlagCreateInput(input: unknown): FeatureFlagCreateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("feature flag input is required");
  }
  const value = input as Record<string, unknown>;
  const code = asString(value.code);
  const name = asString(value.name);
  const description = asString(value.description);
  if (!code) throw new BadRequestError("code is required");
  if (!name) throw new BadRequestError("name is required");
  return {
    code,
    name,
    description: description || undefined,
    isEnabled: typeof value.isEnabled === "boolean" ? value.isEnabled : true,
  };
}

export function validateFeatureFlagUpdateInput(input: unknown): FeatureFlagUpdateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("feature flag update input is required");
  }
  const value = input as Record<string, unknown>;
  const update: FeatureFlagUpdateInput = {};
  if (value.name !== undefined) {
    const name = asString(value.name);
    if (!name) throw new BadRequestError("name cannot be empty");
    update.name = name;
  }
  if (value.description !== undefined) {
    update.description = asString(value.description) || undefined;
  }
  if (value.isEnabled !== undefined) {
    if (typeof value.isEnabled !== "boolean") throw new BadRequestError("isEnabled must be a boolean");
    update.isEnabled = value.isEnabled;
  }
  if (value.status !== undefined) {
    const status = asString(value.status).toUpperCase();
    if (!allowedStatuses.includes(status as FeatureFlagStatus)) {
      throw new BadRequestError("status is invalid");
    }
    update.status = status as FeatureFlagStatus;
  }
  return update;
}
