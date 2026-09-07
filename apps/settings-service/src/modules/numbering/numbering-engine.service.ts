import { ValidationError } from "@school-erp/errors";
import type { NumberingContext, NumberingStream } from "@school-erp/numbering";
import {
  numberingEngineRepository,
  type NumberingEngineRepository,
} from "./numbering-engine.repository";

const STREAMS = new Set<NumberingStream>([
  "ENQUIRY",
  "APPLICATION",
  "ADMISSION",
  "STUDENT_REGISTRATION",
  "CLASS_REGISTER",
  "ROLL_NUMBER",
  "EMPLOYEE",
  "FEE_ORDER",
  "INVOICE",
  "PAYMENT",
  "RECEIPT",
  "BONAFIDE_CERTIFICATE",
  "STUDY_CERTIFICATE",
  "TRANSFER_CERTIFICATE",
  "STUDENT_ID_CARD",
]);

export async function issueNumber(input: unknown, repository?: NumberingEngineRepository) {
  const context = parseContext(input);
  return (repository ?? (await numberingEngineRepository())).issue(context);
}

export async function issueNumbers(input: unknown, repository?: NumberingEngineRepository) {
  if (!Array.isArray(input) || input.length === 0 || input.length > 500) {
    throw new ValidationError([
      { field: "contexts", message: "contexts must contain between 1 and 500 items" },
    ]);
  }
  const contexts = input.map(parseContext);
  const target = repository ?? (await numberingEngineRepository());
  const numbers: string[] = [];
  for (const context of contexts) numbers.push(await target.issue(context));
  return numbers;
}

export async function cancelNumber(
  input: unknown,
  reason: unknown,
  repository?: NumberingEngineRepository,
) {
  const context = parseContext(input);
  if (typeof reason !== "string") {
    throw new ValidationError([{ field: "reason", message: "reason is required" }]);
  }
  return (repository ?? (await numberingEngineRepository())).cancel(context, reason);
}

function parseContext(input: unknown): NumberingContext {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError([{ field: "context", message: "context is required" }]);
  }
  const source = input as Record<string, unknown>;
  const tenantId = requiredString(source.tenantId, "context.tenantId");
  const stream = requiredString(source.stream, "context.stream") as NumberingStream;
  if (!STREAMS.has(stream)) {
    throw new ValidationError([{ field: "context.stream", message: "stream is invalid" }]);
  }
  const context: NumberingContext = {
    tenantId,
    stream,
    idempotencyKey: requiredString(source.idempotencyKey, "context.idempotencyKey"),
  };
  for (const key of [
    "campusId",
    "campusCode",
    "academicYearId",
    "academicYearCode",
    "curriculumId",
    "programId",
    "classId",
    "classCode",
    "sectionId",
  ] as const) {
    if (source[key] !== undefined) context[key] = requiredString(source[key], `context.${key}`);
  }
  if (source.at !== undefined) {
    const at = new Date(requiredString(source.at, "context.at"));
    if (Number.isNaN(at.getTime())) {
      throw new ValidationError([{ field: "context.at", message: "at must be a valid date" }]);
    }
    context.at = at;
  }
  return context;
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError([{ field, message: `${field.split(".").at(-1)} is required` }]);
  }
  return value.trim();
}
