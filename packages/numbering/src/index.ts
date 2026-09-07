import { ConflictError } from "@school-erp/errors";

export type NumberingStream =
  | "ENQUIRY"
  | "APPLICATION"
  | "ADMISSION"
  | "STUDENT_REGISTRATION"
  | "CLASS_REGISTER"
  | "ROLL_NUMBER"
  | "EMPLOYEE"
  | "FEE_ORDER"
  | "INVOICE"
  | "PAYMENT"
  | "RECEIPT"
  | "BONAFIDE_CERTIFICATE"
  | "STUDY_CERTIFICATE"
  | "TRANSFER_CERTIFICATE"
  | "STUDENT_ID_CARD";

export type NumberingScope =
  | "TENANT"
  | "CAMPUS"
  | "ACADEMIC_YEAR"
  | "PROGRAM"
  | "CLASS"
  | "SECTION";

export type NumberingReset = "NEVER" | "ACADEMIC_YEAR" | "CALENDAR_YEAR" | "MONTHLY";

export interface NumberingPolicy {
  tenantId: string;
  stream: NumberingStream;
  format: string;
  padding: number;
  scope: NumberingScope;
  reset: NumberingReset;
  active: boolean;
}

export interface NumberingContext {
  tenantId: string;
  stream: NumberingStream;
  idempotencyKey: string;
  campusId?: string;
  campusCode?: string;
  academicYearId?: string;
  academicYearCode?: string;
  curriculumId?: string;
  programId?: string;
  classId?: string;
  classCode?: string;
  sectionId?: string;
  at?: Date;
}

export interface NumberingGateway {
  issue(context: NumberingContext): Promise<string>;
  cancel(
    context: Pick<NumberingContext, "tenantId" | "stream" | "idempotencyKey">,
    reason: string,
  ): Promise<string>;
}

export function formatNumber(
  policy: Pick<NumberingPolicy, "format" | "padding">,
  sequence: number,
  context: Omit<NumberingContext, "tenantId" | "stream" | "idempotencyKey"> = {},
) {
  const at = context.at ?? new Date();
  const result = policy.format
    .replaceAll("{SEQUENCE}", String(sequence).padStart(policy.padding, "0"))
    .replaceAll("{YEAR}", String(at.getUTCFullYear()))
    .replaceAll("{MONTH}", String(at.getUTCMonth() + 1).padStart(2, "0"))
    .replaceAll("{ACADEMIC_YEAR}", context.academicYearCode ?? String(at.getUTCFullYear()))
    .replaceAll("{CAMPUS_CODE}", context.campusCode ?? "MAIN")
    .replaceAll("{CLASS_CODE}", context.classCode ?? "CLASS");
  if (/\{[^}]+\}/.test(result)) {
    throw new ConflictError("numbering policy requires unavailable context");
  }
  return result;
}

export function numberingScopeKey(
  policy: Pick<NumberingPolicy, "scope">,
  context: NumberingContext,
) {
  if (policy.scope === "CAMPUS") return requiredScope(context.campusId, "campus");
  if (policy.scope === "ACADEMIC_YEAR") {
    return requiredScope(context.academicYearId, "academic year");
  }
  if (policy.scope === "PROGRAM") return requiredScope(context.programId, "program");
  if (policy.scope === "CLASS") return requiredScope(context.classId, "class");
  if (policy.scope === "SECTION") return requiredScope(context.sectionId, "section");
  return "TENANT";
}

export function numberingResetKey(
  policy: Pick<NumberingPolicy, "reset">,
  context: NumberingContext,
) {
  const at = context.at ?? new Date();
  if (policy.reset === "ACADEMIC_YEAR") {
    return requiredScope(context.academicYearId, "academic year");
  }
  if (policy.reset === "CALENDAR_YEAR") return String(at.getUTCFullYear());
  if (policy.reset === "MONTHLY") {
    return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return "NEVER";
}

export function numberingIssuanceId(
  context: Pick<NumberingContext, "tenantId" | "stream" | "idempotencyKey">,
) {
  const key = context.idempotencyKey.trim();
  if (!key) throw new ConflictError("numbering idempotency key is required");
  return `${context.tenantId}:${context.stream}:${key}`;
}

function requiredScope(value: string | undefined, label: string) {
  if (!value?.trim()) throw new ConflictError(`${label} is required by numbering policy`);
  return value.trim();
}
