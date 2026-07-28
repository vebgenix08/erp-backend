import { ValidationError } from "@school-erp/errors";
import {
  optionalString,
  validateEmail,
  validateNonEmptyString,
  validatePhone,
} from "@school-erp/validation";
import type {
  ApplicationCreateInput,
  ApplicationDocumentReference,
  ApplicationGender,
  ApplicationListFilter,
  ApplicationUpdateInput,
} from "./application.model";

const STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "CONFIRMED",
  "CANCELLED",
] as const;
const GENDERS: ApplicationGender[] = ["MALE", "FEMALE", "OTHER"];

function object(input: unknown, field = "input"): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ValidationError([
      { field, message: `${field} must be an object` },
    ]);
  return input as Record<string, unknown>;
}
function required(value: unknown, field: string): string {
  const result = validateNonEmptyString(value, field);
  if (!result.success)
    throw new ValidationError([
      { field, message: result.errors[0] ?? `${field} is required` },
    ]);
  return result.value;
}
function phone(value: unknown, field: string): string {
  const result = validatePhone(value, field);
  if (!result.success)
    throw new ValidationError([
      { field, message: result.errors[0] ?? `${field} is invalid` },
    ]);
  return result.value;
}
function email(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const result = validateEmail(value, "email");
  if (!result.success)
    throw new ValidationError([
      { field: "email", message: result.errors[0] ?? "email is invalid" },
    ]);
  return result.value;
}
function date(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed =
    value instanceof Date
      ? value
      : typeof value === "string"
        ? new Date(value)
        : new Date(Number.NaN);
  if (Number.isNaN(parsed.getTime()))
    throw new ValidationError([
      { field: "dateOfBirth", message: "dateOfBirth must be a valid date" },
    ]);
  return parsed;
}
function gender(value: unknown): ApplicationGender | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized =
    typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!GENDERS.includes(normalized as ApplicationGender))
    throw new ValidationError([
      { field: "gender", message: "gender must be MALE, FEMALE or OTHER" },
    ]);
  return normalized as ApplicationGender;
}
function documents(value: unknown): ApplicationDocumentReference[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value))
    throw new ValidationError([
      { field: "documents", message: "documents must be an array" },
    ]);
  return value.map((item, index) => {
    const document = object(item, `documents.${index}`);
    return {
      fileId: required(document.fileId, `documents.${index}.fileId`),
      documentType: required(
        document.documentType,
        `documents.${index}.documentType`,
      ),
      fileName: required(document.fileName, `documents.${index}.fileName`),
    };
  });
}
function customFields(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function validateApplicationCreateInput(
  input: unknown,
): ApplicationCreateInput {
  const body = object(input);
  const templateVersion = body.templateVersion;
  if (
    typeof templateVersion !== "number" ||
    !Number.isInteger(templateVersion) ||
    templateVersion < 1
  )
    throw new ValidationError([
      {
        field: "templateVersion",
        message: "templateVersion must be a positive integer",
      },
    ]);
  return {
    enquiryId: optionalString(body.enquiryId),
    campusId: required(body.campusId, "campusId"),
    academicYearId: required(body.academicYearId, "academicYearId"),
    academicTargetId: required(body.academicTargetId, "academicTargetId"),
    sectionId: optionalString(body.sectionId),
    studentName: required(body.studentName, "studentName"),
    dateOfBirth: date(body.dateOfBirth),
    gender: gender(body.gender),
    phone: phone(body.phone, "phone"),
    email: email(body.email),
    address: optionalString(body.address),
    parentName: required(body.parentName, "parentName"),
    parentPhone: body.parentPhone
      ? phone(body.parentPhone, "parentPhone")
      : undefined,
    parentRelation: optionalString(body.parentRelation),
    templateId: required(body.templateId, "templateId"),
    templateVersion,
    customFields: customFields(body.customFields),
    documents: documents(body.documents),
  };
}

export function validateApplicationUpdateInput(
  input: unknown,
): ApplicationUpdateInput {
  const body = object(input),
    update: ApplicationUpdateInput = {};
  if (body.academicTargetId !== undefined)
    update.academicTargetId = required(
      body.academicTargetId,
      "academicTargetId",
    );
  if (body.sectionId !== undefined)
    update.sectionId = optionalString(body.sectionId);
  if (body.studentName !== undefined)
    update.studentName = required(body.studentName, "studentName");
  if (body.dateOfBirth !== undefined)
    update.dateOfBirth = date(body.dateOfBirth);
  if (body.gender !== undefined) update.gender = gender(body.gender);
  if (body.phone !== undefined) update.phone = phone(body.phone, "phone");
  if (body.email !== undefined) update.email = email(body.email);
  if (body.address !== undefined) update.address = optionalString(body.address);
  if (body.parentName !== undefined)
    update.parentName = required(body.parentName, "parentName");
  if (body.parentPhone !== undefined)
    update.parentPhone = body.parentPhone
      ? phone(body.parentPhone, "parentPhone")
      : undefined;
  if (body.parentRelation !== undefined)
    update.parentRelation = optionalString(body.parentRelation);
  if (body.customFields !== undefined)
    update.customFields = customFields(body.customFields);
  if (body.documents !== undefined)
    update.documents = documents(body.documents);
  return update;
}

export function validateApplicationListFilter(
  input: unknown,
): ApplicationListFilter {
  if (input === undefined || input === null) return {};
  const body = object(input, "filter"),
    filter: ApplicationListFilter = {};
  if (body.status !== undefined) {
    const status =
      typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
    if (!STATUSES.includes(status as (typeof STATUSES)[number]))
      throw new ValidationError([
        { field: "status", message: "invalid application status" },
      ]);
    filter.status = status as ApplicationListFilter["status"];
  }
  filter.campusId = optionalString(body.campusId);
  filter.academicYearId = optionalString(body.academicYearId);
  filter.academicTargetId = optionalString(body.academicTargetId);
  filter.search = optionalString(body.search);
  const page = body.page === undefined ? 1 : Number(body.page);
  const pageSize = body.pageSize === undefined ? 25 : Number(body.pageSize);
  if (!Number.isInteger(page) || page < 1)
    throw new ValidationError([{ field: "page", message: "page must be a positive integer" }]);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
    throw new ValidationError([{ field: "pageSize", message: "pageSize must be between 1 and 100" }]);
  filter.page = page;
  filter.pageSize = pageSize;
  return filter;
}

export function validateAdmissionConfirmationInput(input: unknown): {
  duplicateReviewAcknowledged: boolean;
} {
  if (input === undefined || input === null)
    return { duplicateReviewAcknowledged: false };
  if (typeof input !== "object" || Array.isArray(input))
    throw new ValidationError([
      { field: "input", message: "input must be an object" },
    ]);
  const value = input as Record<string, unknown>;
  if (
    value.duplicateReviewAcknowledged !== undefined &&
    typeof value.duplicateReviewAcknowledged !== "boolean"
  )
    throw new ValidationError([
      {
        field: "input.duplicateReviewAcknowledged",
        message: "duplicateReviewAcknowledged must be a boolean",
      },
    ]);
  return {
    duplicateReviewAcknowledged: value.duplicateReviewAcknowledged === true,
  };
}

export function validateReviewInput(input: unknown): {
  remarks?: string | undefined;
} {
  const body = object(input);
  return { remarks: optionalString(body.remarks) };
}
export function validateRejectInput(input: unknown): { reason: string } {
  const body = object(input);
  return { reason: required(body.reason, "reason") };
}
