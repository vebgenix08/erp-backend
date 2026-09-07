import { ConflictError, NotFoundError } from "@school-erp/errors";
import {
  createTenantMongoCollection,
  getMongoConnection,
  withTransaction,
  type MongoEnvLike,
  type TenantMongoCollection,
} from "@school-erp/mongodb";
import {
  formatNumber,
  numberingIssuanceId,
  numberingResetKey,
  numberingScopeKey,
  type NumberingContext,
  type NumberingPolicy,
  type NumberingStream,
} from "@school-erp/numbering";

interface PolicyDocument extends NumberingPolicy {
  _id: string;
  id: string;
  version?: number;
  nextNumber?: number;
  issuedCount?: number;
  updatedAt: Date;
}

interface CounterDocument {
  _id: string;
  tenantId: string;
  stream: NumberingStream;
  scopeKey: string;
  resetKey: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

interface IssuanceDocument {
  _id: string;
  tenantId: string;
  stream: NumberingStream;
  idempotencyKey: string;
  number: string;
  counterKey: string;
  sequence: number;
  policyId: string;
  policyVersion: number;
  renderedFormat: string;
  status: "ISSUED" | "CANCELLED";
  issuedAt: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
}

interface ReferenceDocument {
  _id: string;
  tenantId: string;
  id?: string;
  code?: string;
  status?: string;
}

export interface NumberingEngineRepository {
  issue(context: NumberingContext): Promise<string>;
  cancel(
    context: Pick<NumberingContext, "tenantId" | "stream" | "idempotencyKey">,
    reason: string,
  ): Promise<string>;
}

export class InMemoryNumberingEngineRepository implements NumberingEngineRepository {
  private readonly policies = new Map<string, PolicyDocument>();
  private readonly counters = new Map<string, number>();
  private readonly issuances = new Map<string, IssuanceDocument>();

  seedPolicy(policy: PolicyDocument) {
    this.policies.set(`${policy.tenantId}:${policy.stream}`, structuredClone(policy));
  }

  async issue(context: NumberingContext) {
    const issuanceId = numberingIssuanceId(context);
    const repeated = this.issuances.get(issuanceId);
    if (repeated) return repeated.number;
    const policy = this.policies.get(`${context.tenantId}:${context.stream}`);
    if (!policy?.active) throw inactivePolicy(context.stream);
    const counterKey = buildCounterKey(policy, context);
    const initialValue = policy.issuedCount ? 0 : Math.max(0, policy.nextNumber ?? 1) - 1;
    const sequence = (this.counters.get(counterKey) ?? initialValue) + 1;
    this.counters.set(counterKey, sequence);
    const number = formatNumber(policy, sequence, context);
    this.issuances.set(issuanceId, {
      _id: issuanceId,
      tenantId: context.tenantId,
      stream: context.stream,
      idempotencyKey: context.idempotencyKey,
      number,
      counterKey,
      sequence,
      policyId: policy.id,
      policyVersion: policy.version ?? 1,
      renderedFormat: policy.format,
      status: "ISSUED",
      issuedAt: new Date(),
    });
    policy.issuedCount = (policy.issuedCount ?? 0) + 1;
    policy.nextNumber = sequence + 1;
    return number;
  }

  async cancel(
    context: Pick<NumberingContext, "tenantId" | "stream" | "idempotencyKey">,
    reason: string,
  ) {
    const issuance = this.issuances.get(numberingIssuanceId(context));
    if (!issuance) throw new NotFoundError("issued number was not found");
    if (issuance.status !== "CANCELLED") {
      issuance.status = "CANCELLED";
      issuance.cancelledAt = new Date();
      issuance.cancellationReason = requireReason(reason);
    }
    return issuance.number;
  }
}

export class MongoNumberingEngineRepository implements NumberingEngineRepository {
  constructor(
    private readonly policies: TenantMongoCollection<PolicyDocument>,
    private readonly counters: TenantMongoCollection<CounterDocument>,
    private readonly issuances: TenantMongoCollection<IssuanceDocument>,
    private readonly academicYears: TenantMongoCollection<ReferenceDocument>,
    private readonly campuses: TenantMongoCollection<ReferenceDocument>,
    private readonly env: MongoEnvLike,
  ) {}

  async issue(input: NumberingContext) {
    const policy = await this.policies.findOne({
      tenantId: input.tenantId,
      stream: input.stream,
    });
    if (!policy?.active) throw inactivePolicy(input.stream);
    const context = await this.resolveLocalCodes(input, policy);
    const issuanceId = numberingIssuanceId(context);
    const repeated = await this.issuances.findOne({
      tenantId: context.tenantId,
      _id: issuanceId,
    });
    if (repeated) return repeated.number;
    const counterKey = buildCounterKey(policy, context);

    return withTransaction(
      async (session) => {
        const options = session ? { session } : {};
        const existing = await this.issuances.findOne(
          { tenantId: context.tenantId, _id: issuanceId },
          options,
        );
        if (existing) return existing.number;
        const now = new Date();
        await this.counters.updateOne(
          { tenantId: context.tenantId, _id: counterKey },
          {
            $setOnInsert: {
              _id: counterKey,
              tenantId: context.tenantId,
              stream: context.stream,
              scopeKey: numberingScopeKey(policy, context),
              resetKey: numberingResetKey(policy, context),
              value: policy.issuedCount ? 0 : Math.max(0, Number(policy.nextNumber ?? 1) - 1),
              createdAt: now,
            },
            $set: { updatedAt: now },
          },
          { upsert: true, ...options },
        );
        const counter = await this.counters.findOneAndUpdate(
          { tenantId: context.tenantId, _id: counterKey },
          { $inc: { value: 1 }, $set: { updatedAt: now } },
          {
            returnDocument: "after",
            includeResultMetadata: false,
            ...options,
          },
        );
        if (!counter) throw new Error("numbering counter allocation failed");
        const number = formatNumber(policy, counter.value, context);
        await this.issuances.insertOne(
          {
            _id: issuanceId,
            tenantId: context.tenantId,
            stream: context.stream,
            idempotencyKey: context.idempotencyKey,
            number,
            counterKey,
            sequence: counter.value,
            policyId: policy.id,
            policyVersion: policy.version ?? 1,
            renderedFormat: policy.format,
            status: "ISSUED",
            issuedAt: now,
          },
          options,
        );
        await this.policies.updateOne(
          { tenantId: context.tenantId, _id: policy._id },
          {
            $inc: { issuedCount: 1 },
            $set: { nextNumber: counter.value + 1, updatedAt: now },
          },
          options,
        );
        return number;
      },
      { env: this.env, context: { tenantId: context.tenantId } },
    );
  }

  async cancel(
    context: Pick<NumberingContext, "tenantId" | "stream" | "idempotencyKey">,
    reason: string,
  ) {
    const id = numberingIssuanceId(context);
    const issuance = await this.issuances.findOne({ tenantId: context.tenantId, _id: id });
    if (!issuance) throw new NotFoundError("issued number was not found");
    if (issuance.status === "CANCELLED") return issuance.number;
    await this.issuances.updateOne(
      { tenantId: context.tenantId, _id: id, status: "ISSUED" },
      {
        $set: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: requireReason(reason),
        },
      },
    );
    return issuance.number;
  }

  private async resolveLocalCodes(
    input: NumberingContext,
    policy: NumberingPolicy,
  ): Promise<NumberingContext> {
    const context = { ...input };
    if (
      !context.academicYearId &&
      (policy.scope === "ACADEMIC_YEAR" || policy.reset === "ACADEMIC_YEAR")
    ) {
      const activeYear = await this.academicYears.findOne({
        tenantId: context.tenantId,
        status: "ACTIVE",
      });
      if (activeYear) {
        context.academicYearId = activeYear.id ?? activeYear._id;
        if (activeYear.code) context.academicYearCode = activeYear.code;
      }
    }
    if (context.academicYearId && !context.academicYearCode) {
      const year = await this.academicYears.findOne({
        tenantId: context.tenantId,
        $or: [{ _id: context.academicYearId }, { id: context.academicYearId }],
      });
      if (year?.code) context.academicYearCode = year.code;
    }
    if (context.campusId && !context.campusCode) {
      const campus = await this.campuses.findOne({
        tenantId: context.tenantId,
        $or: [{ _id: context.campusId }, { id: context.campusId }],
      });
      if (campus?.code) context.campusCode = campus.code;
    }
    return context;
  }
}

function buildCounterKey(policy: NumberingPolicy, context: NumberingContext) {
  return [
    context.tenantId,
    context.stream,
    numberingScopeKey(policy, context),
    numberingResetKey(policy, context),
  ].join(":");
}

function inactivePolicy(stream: NumberingStream) {
  return new ConflictError(`${stream.toLowerCase()} numbering is not configured or active`);
}

function requireReason(reason: string) {
  const value = reason.trim();
  if (!value) throw new ConflictError("number cancellation reason is required");
  return value;
}

function runtimeEnv(): MongoEnvLike {
  return (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {};
}

export async function createNumberingEngineRepository(
  env: MongoEnvLike = runtimeEnv(),
): Promise<NumberingEngineRepository> {
  const connection = await getMongoConnection(env);
  const db = connection.client.db(connection.dbName);
  const policies = db.collection<PolicyDocument>("settings_numbering_policies");
  const counters = db.collection<CounterDocument>("settings_numbering_counters");
  const issuances = db.collection<IssuanceDocument>("settings_number_issuances");
  const academicYears = db.collection<ReferenceDocument>("settings_academic_years");
  const campuses = db.collection<ReferenceDocument>("settings_campuses");
  return new MongoNumberingEngineRepository(
    createTenantMongoCollection(policies),
    createTenantMongoCollection(counters),
    createTenantMongoCollection(issuances),
    createTenantMongoCollection(academicYears),
    createTenantMongoCollection(campuses),
    env,
  );
}

let singleton: Promise<NumberingEngineRepository> | undefined;
export function numberingEngineRepository() {
  return (singleton ??= createNumberingEngineRepository());
}
