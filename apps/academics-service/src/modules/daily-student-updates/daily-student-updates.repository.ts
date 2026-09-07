import { ConflictError } from "@school-erp/errors";
import {
  createMongoCollectionAdapter,
  getCollection,
  type CollectionAdapter,
  type MongoEnvLike,
} from "@school-erp/mongodb";
import type {
  DailyStudentUpdatePage,
  DailyStudentUpdateRecord,
  DailyStudentUpdateStatus,
} from "./daily-student-updates.model";

interface DailyStudentUpdateDocument extends DailyStudentUpdateRecord {
  _id: string;
}

export interface DailyStudentUpdatePageFilter {
  employeeId: string;
  academicYearId: string;
  subjectOfferingId?: string;
  status?: DailyStudentUpdateStatus;
  page: number;
  pageSize: number;
}

export interface DailyStudentUpdateRepository {
  listPage(tenantId: string, filter: DailyStudentUpdatePageFilter): Promise<DailyStudentUpdatePage>;
  get(tenantId: string, id: string): Promise<DailyStudentUpdateRecord | null>;
  save(
    record: DailyStudentUpdateRecord,
    expectedVersion?: number,
  ): Promise<DailyStudentUpdateRecord>;
}

const clone = (record: DailyStudentUpdateRecord) => structuredClone(record);

export class InMemoryDailyStudentUpdateRepository implements DailyStudentUpdateRepository {
  private readonly records = new Map<string, DailyStudentUpdateRecord>();

  async listPage(tenantId: string, filter: DailyStudentUpdatePageFilter) {
    const rows = [...this.records.values()]
      .filter((item) => item.tenantId === tenantId)
      .filter((item) => item.employeeId === filter.employeeId)
      .filter((item) => item.academicYearId === filter.academicYearId)
      .filter(
        (item) => !filter.subjectOfferingId || item.subjectOfferingId === filter.subjectOfferingId,
      )
      .filter((item) => !filter.status || item.status === filter.status)
      .sort(
        (left, right) =>
          right.updateDate.localeCompare(left.updateDate) ||
          right.updatedAt.localeCompare(left.updatedAt),
      );
    const total = rows.length;
    const offset = (filter.page - 1) * filter.pageSize;
    return {
      items: rows.slice(offset, offset + filter.pageSize).map(clone),
      page: filter.page,
      pageSize: filter.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / filter.pageSize)),
    };
  }

  async get(tenantId: string, id: string) {
    const record = this.records.get(id);
    return record?.tenantId === tenantId ? clone(record) : null;
  }

  async save(record: DailyStudentUpdateRecord, expectedVersion?: number) {
    const current = this.records.get(record.id);
    if (!current) {
      if (expectedVersion !== undefined) throw new ConflictError("daily update version is stale");
    } else if (current.tenantId !== record.tenantId || current.version !== expectedVersion) {
      throw new ConflictError("daily update version is stale");
    }
    this.records.set(record.id, clone(record));
    return clone(record);
  }
}

export class MongoDailyStudentUpdateRepository implements DailyStudentUpdateRepository {
  private readonly adapter: Promise<CollectionAdapter<DailyStudentUpdateDocument>>;

  constructor(runtime: MongoEnvLike) {
    this.adapter = getCollection<DailyStudentUpdateDocument>("daily_student_updates", runtime).then(
      async (collection) => {
        await collection.createIndex({
          tenantId: 1,
          employeeId: 1,
          academicYearId: 1,
          updateDate: -1,
        });
        await collection.createIndex({
          tenantId: 1,
          subjectOfferingId: 1,
          status: 1,
          updateDate: -1,
        });
        return createMongoCollectionAdapter(collection);
      },
    );
  }

  async listPage(tenantId: string, filter: DailyStudentUpdatePageFilter) {
    const adapter = await this.adapter;
    const query = {
      tenantId,
      employeeId: filter.employeeId,
      academicYearId: filter.academicYearId,
      ...(filter.subjectOfferingId ? { subjectOfferingId: filter.subjectOfferingId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    };
    const total = await adapter.count(query);
    const documents = await adapter.findMany(query, {
      sort: { updateDate: -1, updatedAt: -1 },
      skip: (filter.page - 1) * filter.pageSize,
      limit: filter.pageSize,
    });
    return {
      items: documents.map(fromDocument),
      page: filter.page,
      pageSize: filter.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / filter.pageSize)),
    };
  }

  async get(tenantId: string, id: string) {
    const document = await (await this.adapter).findOne({ tenantId, _id: id });
    return document ? fromDocument(document) : null;
  }

  async save(record: DailyStudentUpdateRecord, expectedVersion?: number) {
    const adapter = await this.adapter;
    const document = toDocument(record);
    if (expectedVersion === undefined) return fromDocument(await adapter.insertOne(document));
    const saved = await adapter.replaceOne(
      { tenantId: record.tenantId, _id: record.id, version: expectedVersion },
      document,
    );
    if (!saved) throw new ConflictError("daily update was changed by another user");
    return fromDocument(saved);
  }
}

const toDocument = (record: DailyStudentUpdateRecord): DailyStudentUpdateDocument => ({
  ...structuredClone(record),
  _id: record.id,
});

const fromDocument = (document: DailyStudentUpdateDocument): DailyStudentUpdateRecord => {
  const { _id: _ignored, ...record } = document;
  return structuredClone(record);
};

const runtimeEnv = (): MongoEnvLike =>
  (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {};
let singleton: DailyStudentUpdateRepository | undefined;
export function dailyStudentUpdateRepository(runtime: MongoEnvLike = runtimeEnv()) {
  return (singleton ??= new MongoDailyStudentUpdateRepository(runtime));
}
