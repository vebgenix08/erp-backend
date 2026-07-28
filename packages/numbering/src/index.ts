import { ConflictError } from "@school-erp/errors";
import { getCollection, type MongoEnvLike } from "@school-erp/mongodb";

export type NumberingStream =
  | "ENQUIRY" | "APPLICATION" | "ADMISSION" | "STUDENT_REGISTRATION"
  | "ROLL_NUMBER" | "EMPLOYEE" | "FEE_ORDER" | "INVOICE" | "PAYMENT"
  | "RECEIPT" | "BONAFIDE_CERTIFICATE" | "STUDY_CERTIFICATE"
  | "TRANSFER_CERTIFICATE" | "STUDENT_ID_CARD";

export interface NumberingPolicy {
  tenantId: string;
  stream: NumberingStream;
  format: string;
  padding: number;
  scope: "TENANT" | "CAMPUS" | "ACADEMIC_YEAR" | "PROGRAM" | "CLASS" | "SECTION";
  reset: "NEVER" | "ACADEMIC_YEAR" | "CALENDAR_YEAR" | "MONTHLY";
  active: boolean;
}

export interface NumberingContext {
  tenantId: string;
  stream: NumberingStream;
  campusId?: string;
  campusCode?: string;
  academicYearId?: string;
  academicYearCode?: string;
  programId?: string;
  classId?: string;
  sectionId?: string;
  at?: Date;
}

interface CounterDocument { _id: string; value: number }
interface PolicyDocument extends NumberingPolicy { _id: string; nextNumber?: number; issuedCount?: number }

const fallbackFormats: Partial<Record<NumberingStream, string>> = {
  RECEIPT: "RCP/{ACADEMIC_YEAR}/{SEQUENCE}",
  BONAFIDE_CERTIFICATE: "BON/{YEAR}/{SEQUENCE}",
  STUDY_CERTIFICATE: "STU/{YEAR}/{SEQUENCE}",
  TRANSFER_CERTIFICATE: "TC/{YEAR}/{SEQUENCE}",
  STUDENT_ID_CARD: "IDC/{YEAR}/{SEQUENCE}",
};

export function formatNumber(
  policy: Pick<NumberingPolicy, "format" | "padding">,
  sequence: number,
  context: Omit<NumberingContext, "tenantId" | "stream"> = {},
) {
  const at = context.at ?? new Date();
  const result = policy.format
    .replaceAll("{SEQUENCE}", String(sequence).padStart(policy.padding, "0"))
    .replaceAll("{YEAR}", String(at.getUTCFullYear()))
    .replaceAll("{MONTH}", String(at.getUTCMonth() + 1).padStart(2, "0"))
    .replaceAll("{ACADEMIC_YEAR}", context.academicYearCode ?? String(at.getUTCFullYear()))
    .replaceAll("{CAMPUS_CODE}", context.campusCode ?? "MAIN");
  if (/\{[^}]+\}/.test(result)) throw new ConflictError("numbering policy requires unavailable context");
  return result;
}

function scopeKey(policy: NumberingPolicy, context: NumberingContext) {
  if (policy.scope === "CAMPUS") return context.campusId ?? "NO_CAMPUS";
  if (policy.scope === "ACADEMIC_YEAR") return context.academicYearId ?? "NO_YEAR";
  if (policy.scope === "PROGRAM") return context.programId ?? "NO_PROGRAM";
  if (policy.scope === "CLASS") return context.classId ?? "NO_CLASS";
  if (policy.scope === "SECTION") return context.sectionId ?? "NO_SECTION";
  return "TENANT";
}

function resetKey(policy: NumberingPolicy, context: NumberingContext) {
  const at = context.at ?? new Date();
  if (policy.reset === "ACADEMIC_YEAR") return context.academicYearId ?? String(at.getUTCFullYear());
  if (policy.reset === "CALENDAR_YEAR") return String(at.getUTCFullYear());
  if (policy.reset === "MONTHLY") return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}`;
  return "NEVER";
}

export async function issueConfiguredNumber(context: NumberingContext, env?: MongoEnvLike) {
  const resolved = { ...context };
  if (resolved.academicYearId && !resolved.academicYearCode) {
    const years = await getCollection<{ _id: string; tenantId: string; id?: string; code?: string }>("settings_academic_years", env);
    const year = await years.findOne({ tenantId: resolved.tenantId, $or: [{ _id: resolved.academicYearId }, { id: resolved.academicYearId }] });
    if (year?.code) resolved.academicYearCode = year.code;
  }
  if (resolved.campusId && !resolved.campusCode) {
    const campuses = await getCollection<{ _id: string; tenantId: string; id?: string; code?: string }>("settings_campuses", env);
    const campus = await campuses.findOne({ tenantId: resolved.tenantId, $or: [{ _id: resolved.campusId }, { id: resolved.campusId }] });
    if (campus?.code) resolved.campusCode = campus.code;
  }
  const policies = await getCollection<PolicyDocument>("settings_numbering_policies", env);
  let policy = await policies.findOne({ tenantId: resolved.tenantId, stream: resolved.stream });
  const fallbackFormat = fallbackFormats[resolved.stream];
  if (policy && !policy.format && fallbackFormat) {
    await policies.updateOne({ _id: policy._id }, { $set: { format: fallbackFormat } });
    policy = { ...policy, format: fallbackFormat };
  }
  if (!policy?.active) throw new ConflictError(`${resolved.stream.toLowerCase()} numbering is not configured or active`);
  const counters = await getCollection<CounterDocument>("shared_numbering_counters", env);
  const key = [resolved.tenantId, resolved.stream, scopeKey(policy, resolved), resetKey(policy, resolved)].join(":");
  if (!(await counters.findOne({ _id: key }))) {
    const source =
      resolved.stream === "RECEIPT"
        ? { collection: "finance_payments", field: "receiptNumber" }
        : { collection: "student_documents", field: "documentNumber" };
    const history = await getCollection<Record<string, unknown>>(source.collection, env);
    const historyFilter =
      resolved.stream === "RECEIPT"
        ? { tenantId: resolved.tenantId }
        : { tenantId: resolved.tenantId, documentType: resolved.stream };
    const rows = await history
      .find(historyFilter, { projection: { [source.field]: 1 } })
      .toArray();
    const maximum = rows.reduce((current, row) => {
      const match = String(row[source.field] ?? "").match(/(\d+)$/);
      return Math.max(current, match ? Number(match[1]) : 0);
    }, 0);
    await counters.updateOne({ _id: key }, { $setOnInsert: { value: maximum } }, { upsert: true });
  }
  const counter = await counters.findOneAndUpdate(
    { _id: key },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: "after", includeResultMetadata: false },
  );
  const sequence = counter?.value ?? 1;
  await policies.updateOne(
    { _id: policy._id },
    { $inc: { issuedCount: 1 }, $set: { nextNumber: sequence + 1, updatedAt: new Date() } },
  );
  return formatNumber(policy, sequence, resolved);
}
