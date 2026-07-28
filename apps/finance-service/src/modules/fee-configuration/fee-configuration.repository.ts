import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@school-erp/errors";
import type { CollectionAdapter, MongoEnvLike } from "@school-erp/mongodb";
import {
  createMongoCollectionAdapter,
  getCollection,
} from "@school-erp/mongodb";
import type {
  CreateFeeHeadInput,
  CreateFeeMappingInput,
  CreateFeeScheduleInput,
  CreateFeeStructureInput,
  FeeConfigurationScope,
  FeeConfigurationSnapshot,
  FeeHeadRecord,
  FeeMappingRecord,
  FeeScheduleRecord,
  FeeStructureRecord,
  FinanceRecordStatus,
  UpdateFeeHeadInput,
} from "./fee-configuration.model";

export interface FeeConfigurationRepository {
  snapshot(
    tenantId: string,
    scope: FeeConfigurationScope,
  ): Promise<FeeConfigurationSnapshot>;
  getFeeHead(tenantId: string, id: string): Promise<FeeHeadRecord | null>;
  getSchedule(tenantId: string, id: string): Promise<FeeScheduleRecord | null>;
  getStructure(
    tenantId: string,
    id: string,
  ): Promise<FeeStructureRecord | null>;
  createFeeHead(
    tenantId: string,
    actorId: string,
    input: CreateFeeHeadInput,
  ): Promise<FeeHeadRecord>;
  updateFeeHead(
    tenantId: string,
    id: string,
    actorId: string,
    input: UpdateFeeHeadInput,
  ): Promise<FeeHeadRecord>;
  createSchedule(
    tenantId: string,
    actorId: string,
    input: CreateFeeScheduleInput,
  ): Promise<FeeScheduleRecord>;
  createStructure(
    tenantId: string,
    actorId: string,
    input: CreateFeeStructureInput,
  ): Promise<FeeStructureRecord>;
  createMapping(
    tenantId: string,
    actorId: string,
    input: CreateFeeMappingInput,
  ): Promise<FeeMappingRecord>;
  setStatus(
    tenantId: string,
    entity: "fee-head" | "schedule" | "structure" | "mapping",
    id: string,
    status: FinanceRecordStatus,
    actorId: string,
  ): Promise<boolean>;
}

type EntityRecord =
  | FeeHeadRecord
  | FeeScheduleRecord
  | FeeStructureRecord
  | FeeMappingRecord;
interface EntityDocument extends Record<string, unknown> {
  _id: string;
  tenantId: string;
  kind: "FEE_HEAD" | "SCHEDULE" | "STRUCTURE" | "MAPPING";
  record: EntityRecord;
}
interface SequenceDocument extends Record<string, unknown> {
  _id: string;
  value: number;
}

const clone = <T extends EntityRecord>(record: T): T => ({
  ...record,
  createdAt: new Date(record.createdAt),
  updatedAt: new Date(record.updatedAt),
});
const tenant = (tenantId: string) => {
  const value = tenantId.trim();
  if (!value) throw new BadRequestError("tenantId is required");
  return value;
};
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const targetKey = (input: CreateFeeMappingInput) =>
  [
    input.campusId,
    input.academicYearId,
    input.target.programId ?? "*",
    input.target.classId,
    input.target.sectionId ?? "*",
  ].join(":");

abstract class BaseFeeConfigurationRepository
  implements FeeConfigurationRepository
{
  protected abstract listDocuments(
    tenantId: string,
    scope?: FeeConfigurationScope,
  ): Promise<EntityDocument[]>;
  protected abstract findDocument(
    tenantId: string,
    id: string,
  ): Promise<EntityDocument | null>;
  protected abstract saveDocument(document: EntityDocument): Promise<void>;
  protected abstract replaceDocument(
    document: EntityDocument,
  ): Promise<boolean>;
  protected abstract nextCode(
    tenantId: string,
    key: string,
    prefix: string,
  ): Promise<string>;

  async snapshot(
    tenantId: string,
    scope: FeeConfigurationScope,
  ): Promise<FeeConfigurationSnapshot> {
    const records = (await this.listDocuments(tenant(tenantId), scope)).map(
      (document) => clone(document.record),
    );
    return {
      feeHeads: records.filter(
        (record): record is FeeHeadRecord => "category" in record,
      ),
      schedules: records.filter(
        (record): record is FeeScheduleRecord =>
          "pattern" in record &&
          record.campusId === scope.campusId &&
          record.academicYearId === scope.academicYearId,
      ),
      structures: records.filter(
        (record): record is FeeStructureRecord =>
          "components" in record &&
          record.campusId === scope.campusId &&
          record.academicYearId === scope.academicYearId,
      ),
      mappings: records.filter(
        (record): record is FeeMappingRecord =>
          "target" in record &&
          record.campusId === scope.campusId &&
          record.academicYearId === scope.academicYearId,
      ),
    };
  }

  async getFeeHead(tenantId: string, recordId: string) {
    const document = await this.findDocument(tenant(tenantId), recordId);
    return document?.kind === "FEE_HEAD"
      ? clone(document.record as FeeHeadRecord)
      : null;
  }
  async getSchedule(tenantId: string, recordId: string) {
    const document = await this.findDocument(tenant(tenantId), recordId);
    return document?.kind === "SCHEDULE"
      ? clone(document.record as FeeScheduleRecord)
      : null;
  }
  async getStructure(tenantId: string, recordId: string) {
    const document = await this.findDocument(tenant(tenantId), recordId);
    return document?.kind === "STRUCTURE"
      ? clone(document.record as FeeStructureRecord)
      : null;
  }

  async createFeeHead(
    tenantId: string,
    actorId: string,
    input: CreateFeeHeadInput,
  ) {
    const normalizedTenantId = tenant(tenantId);
    const documents = await this.listDocuments(normalizedTenantId);
    if (
      documents.some(
        (document) =>
          document.kind === "FEE_HEAD" &&
          (document.record as FeeHeadRecord).name.toLowerCase() ===
            input.name.toLowerCase(),
      )
    )
      throw new ConflictError("fee head name must be unique");
    const now = new Date();
    const record: FeeHeadRecord = {
      id: id("fee_head"),
      tenantId: normalizedTenantId,
      code: await this.nextCode(normalizedTenantId, "fee-head", "FH"),
      name: input.name,
      category: input.category,
      refundable: input.refundable ?? false,
      status: "ACTIVE",
      createdBy: actorId,
      updatedBy: actorId,
      createdAt: now,
      updatedAt: now,
    };
    if (input.description) record.description = input.description;
    await this.saveDocument({
      _id: record.id,
      tenantId: normalizedTenantId,
      kind: "FEE_HEAD",
      record,
    });
    return clone(record);
  }

  async updateFeeHead(
    tenantId: string,
    recordId: string,
    actorId: string,
    input: UpdateFeeHeadInput,
  ) {
    const normalizedTenantId = tenant(tenantId);
    const document = await this.findDocument(normalizedTenantId, recordId);
    if (!document || document.kind !== "FEE_HEAD")
      throw new NotFoundError("fee head was not found");
    const documents = await this.listDocuments(normalizedTenantId);
    if (
      documents.some(
        (item) =>
          item._id !== recordId &&
          item.kind === "FEE_HEAD" &&
          (item.record as FeeHeadRecord).name.toLowerCase() ===
            input.name.toLowerCase(),
      )
    )
      throw new ConflictError("fee head name must be unique");
    const current = document.record as FeeHeadRecord;
    const updated: FeeHeadRecord = {
      ...current,
      name: input.name,
      category: input.category,
      refundable: input.refundable ?? false,
      updatedBy: actorId,
      updatedAt: new Date(),
    };
    if (input.description) updated.description = input.description;
    else delete updated.description;
    document.record = updated;
    if (!(await this.replaceDocument(document)))
      throw new ConflictError("fee head could not be updated");
    return clone(updated);
  }

  async createSchedule(
    tenantId: string,
    actorId: string,
    input: CreateFeeScheduleInput,
  ) {
    const normalizedTenantId = tenant(tenantId);
    const now = new Date();
    const record: FeeScheduleRecord = {
      id: id("fee_schedule"),
      tenantId: normalizedTenantId,
      campusId: input.campusId,
      academicYearId: input.academicYearId,
      code: await this.nextCode(
        normalizedTenantId,
        `schedule:${input.academicYearId}`,
        "FS",
      ),
      name: input.name,
      pattern: input.pattern,
      collectionPolicy: input.collectionPolicy,
      status: "ACTIVE",
      createdBy: actorId,
      updatedBy: actorId,
      createdAt: now,
      updatedAt: now,
    };
    await this.saveDocument({
      _id: record.id,
      tenantId: normalizedTenantId,
      kind: "SCHEDULE",
      record,
    });
    return clone(record);
  }

  async createStructure(
    tenantId: string,
    actorId: string,
    input: CreateFeeStructureInput,
  ) {
    const normalizedTenantId = tenant(tenantId);
    for (const component of input.components) {
      const head = await this.getFeeHead(
        normalizedTenantId,
        component.feeHeadId,
      );
      if (!head || head.status !== "ACTIVE")
        throw new NotFoundError(
          `active fee head ${component.feeHeadId} was not found`,
        );
    }
    const now = new Date();
    const record: FeeStructureRecord = {
      id: id("fee_structure"),
      tenantId: normalizedTenantId,
      campusId: input.campusId,
      academicYearId: input.academicYearId,
      code: await this.nextCode(
        normalizedTenantId,
        `structure:${input.academicYearId}`,
        "FST",
      ),
      name: input.name,
      currency: "INR",
      components: input.components.map((item) => ({ ...item })),
      totalAmountMinor: input.components.reduce(
        (sum, item) => sum + item.amountMinor,
        0,
      ),
      status: "ACTIVE",
      createdBy: actorId,
      updatedBy: actorId,
      createdAt: now,
      updatedAt: now,
    };
    await this.saveDocument({
      _id: record.id,
      tenantId: normalizedTenantId,
      kind: "STRUCTURE",
      record,
    });
    return clone(record);
  }

  async createMapping(
    tenantId: string,
    actorId: string,
    input: CreateFeeMappingInput,
  ) {
    const normalizedTenantId = tenant(tenantId);
    const [structure, schedule] = await Promise.all([
      this.getStructure(normalizedTenantId, input.structureId),
      this.getSchedule(normalizedTenantId, input.scheduleId),
    ]);
    if (!structure || structure.status !== "ACTIVE")
      throw new NotFoundError("active fee structure was not found");
    if (!schedule || schedule.status !== "ACTIVE")
      throw new NotFoundError("active fee schedule was not found");
    if (
      structure.campusId !== input.campusId ||
      structure.academicYearId !== input.academicYearId ||
      schedule.campusId !== input.campusId ||
      schedule.academicYearId !== input.academicYearId
    )
      throw new ConflictError(
        "structure and schedule must belong to the selected campus and academic year",
      );
    const key = targetKey(input);
    const existing = await this.listDocuments(normalizedTenantId);
    if (
      existing.some(
        (document) =>
          document.kind === "MAPPING" &&
          (document.record as FeeMappingRecord).status === "ACTIVE" &&
          targetKey(document.record as FeeMappingRecord) === key,
      )
    )
      throw new ConflictError(
        "an active fee mapping already exists for this target",
      );
    const now = new Date();
    const record: FeeMappingRecord = {
      id: id("fee_mapping"),
      tenantId: normalizedTenantId,
      campusId: input.campusId,
      academicYearId: input.academicYearId,
      structureId: input.structureId,
      scheduleId: input.scheduleId,
      target: { ...input.target },
      status: "ACTIVE",
      createdBy: actorId,
      updatedBy: actorId,
      createdAt: now,
      updatedAt: now,
    };
    await this.saveDocument({
      _id: record.id,
      tenantId: normalizedTenantId,
      kind: "MAPPING",
      record,
    });
    return clone(record);
  }

  async setStatus(
    tenantId: string,
    entity: "fee-head" | "schedule" | "structure" | "mapping",
    recordId: string,
    status: FinanceRecordStatus,
    actorId: string,
  ) {
    const kinds = {
      "fee-head": "FEE_HEAD",
      schedule: "SCHEDULE",
      structure: "STRUCTURE",
      mapping: "MAPPING",
    } as const;
    const document = await this.findDocument(tenant(tenantId), recordId);
    if (!document || document.kind !== kinds[entity]) return false;
    document.record = {
      ...document.record,
      status,
      updatedBy: actorId,
      updatedAt: new Date(),
    };
    return this.replaceDocument(document);
  }
}

export class InMemoryFeeConfigurationRepository extends BaseFeeConfigurationRepository {
  private readonly documents = new Map<string, EntityDocument>();
  private readonly sequences = new Map<string, number>();
  protected async listDocuments(
    tenantId: string,
    scope?: FeeConfigurationScope,
  ) {
    return [...this.documents.values()]
      .filter(
        (item) =>
          item.tenantId === tenantId &&
          (!scope ||
            item.kind === "FEE_HEAD" ||
            ((
              item.record as
                | FeeScheduleRecord
                | FeeStructureRecord
                | FeeMappingRecord
            ).campusId === scope.campusId &&
              (
                item.record as
                  | FeeScheduleRecord
                  | FeeStructureRecord
                  | FeeMappingRecord
              ).academicYearId === scope.academicYearId)),
      )
      .map((item) => ({ ...item, record: clone(item.record) }));
  }
  protected async findDocument(tenantId: string, recordId: string) {
    const document = this.documents.get(recordId);
    return document?.tenantId === tenantId
      ? { ...document, record: clone(document.record) }
      : null;
  }
  protected async saveDocument(document: EntityDocument) {
    this.documents.set(document._id, {
      ...document,
      record: clone(document.record),
    });
  }
  protected async replaceDocument(document: EntityDocument) {
    if (!this.documents.has(document._id)) return false;
    await this.saveDocument(document);
    return true;
  }
  protected async nextCode(tenantId: string, key: string, prefix: string) {
    const sequenceKey = `${tenantId}:${key}`;
    const value = (this.sequences.get(sequenceKey) ?? 0) + 1;
    this.sequences.set(sequenceKey, value);
    return `${prefix}-${String(value).padStart(4, "0")}`;
  }
}

class MongoFeeConfigurationRepository extends BaseFeeConfigurationRepository {
  constructor(
    private readonly collection: CollectionAdapter<EntityDocument>,
    private readonly sequences: CollectionAdapter<SequenceDocument>,
  ) {
    super();
  }
  protected async listDocuments(
    tenantId: string,
    scope?: FeeConfigurationScope,
  ) {
    const query: Record<string, unknown> = { tenantId };
    if (scope)
      query.$or = [
        { kind: "FEE_HEAD" },
        {
          "record.campusId": scope.campusId,
          "record.academicYearId": scope.academicYearId,
        },
      ];
    return this.collection.findMany(query);
  }
  protected async findDocument(tenantId: string, recordId: string) {
    return this.collection.findOne({ tenantId, _id: recordId });
  }
  protected async saveDocument(document: EntityDocument) {
    await this.collection.insertOne(document);
  }
  protected async replaceDocument(document: EntityDocument) {
    return Boolean(
      await this.collection.replaceOne(
        { tenantId: document.tenantId, _id: document._id },
        document,
      ),
    );
  }
  protected async nextCode(tenantId: string, key: string, prefix: string) {
    const result = await this.sequences.findOneAndUpdate(
      { _id: `${tenantId}:${key}` },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return `${prefix}-${String(result?.value ?? 1).padStart(4, "0")}`;
  }
}

function runtimeEnv(): MongoEnvLike {
  return (
    (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process
      ?.env ?? {}
  );
}
function hasMongo(env: MongoEnvLike) {
  return Boolean(
    env.MONGODB_URI ||
      env.MONGODB_URI_DEV ||
      env.MONGODB_URI_PROD ||
      env.MONGODB_URI_TEST,
  );
}
export async function createFeeConfigurationRepository(
  env: MongoEnvLike = runtimeEnv(),
): Promise<FeeConfigurationRepository> {
  if (!hasMongo(env)) return new InMemoryFeeConfigurationRepository();
  const collection = await getCollection<EntityDocument>(
    "finance_configuration",
    env,
  );
  const sequences = await getCollection<SequenceDocument>(
    "finance_sequences",
    env,
  );
  await collection.createIndex({ tenantId: 1, kind: 1 });
  await collection.createIndex({ tenantId: 1, _id: 1 }, { unique: true });
  return new MongoFeeConfigurationRepository(
    createMongoCollectionAdapter(collection),
    createMongoCollectionAdapter(sequences),
  );
}

let defaultRepository: Promise<FeeConfigurationRepository> | undefined;
export function feeConfigurationRepository() {
  defaultRepository ??= createFeeConfigurationRepository();
  return defaultRepository;
}
