import { ConflictError } from "@school-erp/errors";
import { getMongoConnection, withTransaction, type MongoEnvLike } from "@school-erp/mongodb";

export type NumberingStream =
  | "ENQUIRY" | "APPLICATION" | "ADMISSION" | "STUDENT_REGISTRATION"
  | "CLASS_REGISTER" | "ROLL_NUMBER" | "EMPLOYEE" | "FEE_ORDER" | "INVOICE" | "PAYMENT"
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

interface CounterDocument { _id: string; value: number }
interface PolicyDocument extends NumberingPolicy { _id: string; nextNumber?: number; issuedCount?: number }
interface IssuanceDocument {
  _id: string;
  tenantId: string;
  stream: NumberingStream;
  idempotencyKey: string;
  number: string;
  counterKey: string;
  sequence: number;
  status: "ISSUED" | "CANCELLED";
  issuedAt: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
}

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

function issuanceId(context: NumberingContext) {
  const key = context.idempotencyKey.trim();
  if (!key) throw new ConflictError("numbering idempotency key is required");
  return `${context.tenantId}:${context.stream}:${key}`;
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
  const requestId = issuanceId(resolved);
  const connection = await getMongoConnection(env);
  const stage = connection.config.stage;
  const numberingDb = connection.client.db(
    env?.MONGODB_NUMBERING_DB_NAME?.trim() || `settings-service_${stage}`,
  );
  const issuances = numberingDb.collection<IssuanceDocument>("shared_number_issuances");
  await issuances.createIndex(
    { tenantId: 1, stream: 1, idempotencyKey: 1 },
    { unique: true, name: "uq_number_issuance_idempotency" },
  );
  const existingIssuance = await issuances.findOne({ _id: requestId });
  if (existingIssuance) return existingIssuance.number;
  if (resolved.academicYearId && !resolved.academicYearCode) {
    const years = numberingDb.collection<{ _id: string; tenantId: string; id?: string; code?: string }>("settings_academic_years");
    const year = await years.findOne({ tenantId: resolved.tenantId, $or: [{ _id: resolved.academicYearId }, { id: resolved.academicYearId }] });
    if (year?.code) resolved.academicYearCode = year.code;
  }
  if (resolved.campusId && !resolved.campusCode) {
    const campuses = numberingDb.collection<{ _id: string; tenantId: string; id?: string; code?: string }>("settings_campuses");
    const campus = await campuses.findOne({ tenantId: resolved.tenantId, $or: [{ _id: resolved.campusId }, { id: resolved.campusId }] });
    if (campus?.code) resolved.campusCode = campus.code;
  }
  const policies = numberingDb.collection<PolicyDocument>("settings_numbering_policies");
  let policy = await policies.findOne({ tenantId: resolved.tenantId, stream: resolved.stream });
  const fallbackFormat = fallbackFormats[resolved.stream];
  if (policy && !policy.format && fallbackFormat) {
    await policies.updateOne({ _id: policy._id }, { $set: { format: fallbackFormat } });
    policy = { ...policy, format: fallbackFormat };
  }
  if (!policy?.active) throw new ConflictError(`${resolved.stream.toLowerCase()} numbering is not configured or active`);
  const counters = numberingDb.collection<CounterDocument>("shared_numbering_counters");
  const key = [resolved.tenantId, resolved.stream, scopeKey(policy, resolved), resetKey(policy, resolved)].join(":");
  if (!(await counters.findOne({ _id: key }))) {
    const source =
      resolved.stream === "RECEIPT"
        ? { collection: "finance_payments", field: "receiptNumber" }
        : { collection: "student_documents", field: "documentNumber" };
    const historyDbName =
      resolved.stream === "RECEIPT"
        ? env?.MONGODB_FINANCE_DB_NAME?.trim() || `finance-service_${stage}`
        : env?.MONGODB_ACADEMICS_DB_NAME?.trim() || `academics-service_${stage}`;
    const history = connection.client.db(historyDbName).collection<Record<string, unknown>>(source.collection);
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
  return withTransaction(async (session) => {
    const options = session ? { session } : {};
    const repeated = await issuances.findOne({ _id: requestId }, options);
    if (repeated) return repeated.number;
    const counter = await counters.findOneAndUpdate(
      { _id: key },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after", includeResultMetadata: false, ...options },
    );
    const sequence = counter?.value ?? 1;
    const number = formatNumber(policy, sequence, resolved);
    const issuedAt = new Date();
    await issuances.insertOne({
      _id: requestId,
      tenantId: resolved.tenantId,
      stream: resolved.stream,
      idempotencyKey: resolved.idempotencyKey,
      number,
      counterKey: key,
      sequence,
      status: "ISSUED",
      issuedAt,
    }, options);
    await policies.updateOne(
      { _id: policy._id },
      { $inc: { issuedCount: 1 }, $set: { nextNumber: sequence + 1, updatedAt: issuedAt } },
      options,
    );
    return number;
  }, { env, context: { tenantId: resolved.tenantId } });
}

export async function cancelConfiguredNumber(
  context: Pick<NumberingContext, "tenantId" | "stream" | "idempotencyKey">,
  reason: string,
  env?: MongoEnvLike,
) {
  const normalizedReason = reason.trim();
  if (!normalizedReason) throw new ConflictError("number cancellation reason is required");
  const connection = await getMongoConnection(env);
  const numberingDb = connection.client.db(
    env?.MONGODB_NUMBERING_DB_NAME?.trim() || `settings-service_${connection.config.stage}`,
  );
  const issuances = numberingDb.collection<IssuanceDocument>("shared_number_issuances");
  const id = issuanceId(context);
  const issuance = await issuances.findOne({ _id: id });
  if (!issuance) throw new ConflictError("issued number was not found");
  if (issuance.status === "CANCELLED") return issuance.number;
  await issuances.updateOne(
    { _id: id, status: "ISSUED" },
    { $set: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: normalizedReason } },
  );
  return issuance.number;
}
