import { BadRequestError } from "@school-erp/errors";
import type {
  PlatformIntegrationCode,
  PlatformIntegrationInput,
  PlatformIntegrationStatus,
} from "./integrations.model";
const CODES = ["EMAIL", "SMS", "PAYMENTS", "STORAGE"];
const STATUSES = ["CONFIGURED", "DISABLED", "DEGRADED"];
export function validatePlatformIntegrationInput(
  input: unknown,
): PlatformIntegrationInput {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestError("integration input is required");
  const v = input as Record<string, unknown>;
  const code = String(v.code ?? "").toUpperCase();
  const status = String(v.status ?? "").toUpperCase();
  if (!CODES.includes(code))
    throw new BadRequestError("integration code is invalid");
  if (!STATUSES.includes(status))
    throw new BadRequestError("integration status is invalid");
  const secretReference =
    typeof v.secretReference === "string"
      ? v.secretReference.trim()
      : undefined;
  if (
    secretReference &&
    secretReference.includes("arn:aws:secretsmanager") === false
  )
    throw new BadRequestError("secretReference must be a Secrets Manager ARN");
  const settings =
    v.settings && typeof v.settings === "object" && !Array.isArray(v.settings)
      ? (v.settings as Record<string, string | boolean | number>)
      : {};
  return {
    code: code as PlatformIntegrationCode,
    status: status as PlatformIntegrationStatus,
    secretReference,
    settings,
  };
}
