import { BadRequestError } from "@school-erp/errors";
import { isNonEmptyString, validateEmail, validatePhone } from "@school-erp/validation";
import type { InstitutionProfileInput, InstitutionProfileUpdateInput } from "./institution.model";

function normalizeOptional(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function validateInstitutionProfileInput(input: unknown): InstitutionProfileInput {
  if (!input || typeof input !== "object") {
    throw new BadRequestError("institution profile payload is required");
  }

  const payload = input as Record<string, unknown>;
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!isNonEmptyString(name)) {
    throw new BadRequestError("institution name is required");
  }

  const contactEmail = normalizeOptional(payload.contactEmail);
  if (contactEmail && !validateEmail(contactEmail)) {
    throw new BadRequestError("contact email is invalid");
  }

  const contactPhone = normalizeOptional(payload.contactPhone);
  if (contactPhone && !validatePhone(contactPhone)) {
    throw new BadRequestError("contact phone is invalid");
  }

  return {
    name,
    ...(normalizeOptional(payload.shortName) !== undefined ? { shortName: normalizeOptional(payload.shortName) } : {}),
    ...(contactEmail !== undefined ? { contactEmail } : {}),
    ...(contactPhone !== undefined ? { contactPhone } : {}),
    ...(normalizeOptional(payload.address) !== undefined ? { address: normalizeOptional(payload.address) } : {}),
    ...(normalizeOptional(payload.logoUrl) !== undefined ? { logoUrl: normalizeOptional(payload.logoUrl) } : {}),
  };
}

export function validateInstitutionProfileUpdateInput(input: unknown): InstitutionProfileUpdateInput {
  if (!input || typeof input !== "object") {
    throw new BadRequestError("institution profile payload is required");
  }

  const payload = input as Record<string, unknown>;
  const result: InstitutionProfileUpdateInput = {};

  if (typeof payload.name === "string") {
    const name = payload.name.trim();
    if (!isNonEmptyString(name)) {
      throw new BadRequestError("institution name is required");
    }
    result.name = name;
  }

  const shortName = normalizeOptional(payload.shortName);
  if (shortName !== undefined) result.shortName = shortName;

  const contactEmail = normalizeOptional(payload.contactEmail);
  if (contactEmail !== undefined) {
    if (!validateEmail(contactEmail)) {
      throw new BadRequestError("contact email is invalid");
    }
    result.contactEmail = contactEmail;
  }

  const contactPhone = normalizeOptional(payload.contactPhone);
  if (contactPhone !== undefined) {
    if (!validatePhone(contactPhone)) {
      throw new BadRequestError("contact phone is invalid");
    }
    result.contactPhone = contactPhone;
  }

  const address = normalizeOptional(payload.address);
  if (address !== undefined) result.address = address;

  const logoUrl = normalizeOptional(payload.logoUrl);
  if (logoUrl !== undefined) result.logoUrl = logoUrl;

  return result;
}
