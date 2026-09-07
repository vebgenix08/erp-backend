import { ConflictError } from "@school-erp/errors";
import {
  createMongoCollectionAdapter,
  getCollection,
  type CollectionAdapter,
  type MongoEnvLike,
  type TenantFilter,
} from "@school-erp/mongodb";
import type {
  LessonPlanRecord,
  LessonPlanStatus,
  TeacherContentPage,
  TeachingDiaryRecord,
  TeachingDiaryStatus,
  TeachingResourceRecord,
  TeachingResourceStatus,
} from "./teacher-content.model";

export interface TeacherContentPageFilter<Status extends string> {
  employeeId: string;
  academicYearId: string;
  subjectOfferingId?: string;
  status?: Status;
  page: number;
  pageSize: number;
}

export interface TeacherContentRepository {
  listLessonPlans(
    tenantId: string,
    filter: TeacherContentPageFilter<LessonPlanStatus>,
  ): Promise<TeacherContentPage<LessonPlanRecord>>;
  getLessonPlan(tenantId: string, id: string): Promise<LessonPlanRecord | null>;
  saveLessonPlan(record: LessonPlanRecord, expectedVersion?: number): Promise<LessonPlanRecord>;
  listDiaryEntries(
    tenantId: string,
    filter: TeacherContentPageFilter<TeachingDiaryStatus>,
  ): Promise<TeacherContentPage<TeachingDiaryRecord>>;
  getDiaryEntry(tenantId: string, id: string): Promise<TeachingDiaryRecord | null>;
  saveDiaryEntry(
    record: TeachingDiaryRecord,
    expectedVersion?: number,
  ): Promise<TeachingDiaryRecord>;
  listResources(
    tenantId: string,
    filter: TeacherContentPageFilter<TeachingResourceStatus>,
  ): Promise<TeacherContentPage<TeachingResourceRecord>>;
  getResource(tenantId: string, id: string): Promise<TeachingResourceRecord | null>;
  saveResource(
    record: TeachingResourceRecord,
    expectedVersion?: number,
  ): Promise<TeachingResourceRecord>;
}

interface TeacherContentStoredBase {
  id: string;
  tenantId: string;
  employeeId: string;
  academicYearId: string;
  subjectOfferingId: string;
  status: string;
  version: number;
}
type Stored<T extends { tenantId: string }> = T & { _id: string };
const clone = <T>(record: T): T => structuredClone(record);

function page<
  T extends {
    tenantId: string;
    employeeId: string;
    academicYearId: string;
    subjectOfferingId: string;
    status: string;
    updatedAt: string;
  },
>(
  records: Iterable<T>,
  tenantId: string,
  filter: TeacherContentPageFilter<string>,
): TeacherContentPage<T> {
  const rows = [...records]
    .filter(
      (item) =>
        item.tenantId === tenantId &&
        item.employeeId === filter.employeeId &&
        item.academicYearId === filter.academicYearId,
    )
    .filter(
      (item) => !filter.subjectOfferingId || item.subjectOfferingId === filter.subjectOfferingId,
    )
    .filter((item) => !filter.status || item.status === filter.status)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
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

function saveMemory<T extends { id: string; tenantId: string; version: number }>(
  map: Map<string, T>,
  record: T,
  expectedVersion?: number,
): T {
  const current = map.get(record.id);
  if (
    (!current && expectedVersion !== undefined) ||
    (current && (current.tenantId !== record.tenantId || current.version !== expectedVersion))
  ) {
    throw new ConflictError("teacher content version is stale");
  }
  map.set(record.id, clone(record));
  return clone(record);
}

export class InMemoryTeacherContentRepository implements TeacherContentRepository {
  private readonly lessonPlans = new Map<string, LessonPlanRecord>();
  private readonly diaryEntries = new Map<string, TeachingDiaryRecord>();
  private readonly resources = new Map<string, TeachingResourceRecord>();

  async listLessonPlans(tenantId: string, filter: TeacherContentPageFilter<LessonPlanStatus>) {
    return page(this.lessonPlans.values(), tenantId, filter);
  }
  async getLessonPlan(tenantId: string, id: string) {
    const value = this.lessonPlans.get(id);
    return value?.tenantId === tenantId ? clone(value) : null;
  }
  async saveLessonPlan(record: LessonPlanRecord, expectedVersion?: number) {
    return saveMemory(this.lessonPlans, record, expectedVersion);
  }
  async listDiaryEntries(tenantId: string, filter: TeacherContentPageFilter<TeachingDiaryStatus>) {
    return page(this.diaryEntries.values(), tenantId, filter);
  }
  async getDiaryEntry(tenantId: string, id: string) {
    const value = this.diaryEntries.get(id);
    return value?.tenantId === tenantId ? clone(value) : null;
  }
  async saveDiaryEntry(record: TeachingDiaryRecord, expectedVersion?: number) {
    return saveMemory(this.diaryEntries, record, expectedVersion);
  }
  async listResources(tenantId: string, filter: TeacherContentPageFilter<TeachingResourceStatus>) {
    return page(this.resources.values(), tenantId, filter);
  }
  async getResource(tenantId: string, id: string) {
    const value = this.resources.get(id);
    return value?.tenantId === tenantId ? clone(value) : null;
  }
  async saveResource(record: TeachingResourceRecord, expectedVersion?: number) {
    return saveMemory(this.resources, record, expectedVersion);
  }
}

export class MongoTeacherContentRepository implements TeacherContentRepository {
  private readonly lessonPlans: Promise<CollectionAdapter<Stored<LessonPlanRecord>>>;
  private readonly diaryEntries: Promise<CollectionAdapter<Stored<TeachingDiaryRecord>>>;
  private readonly resources: Promise<CollectionAdapter<Stored<TeachingResourceRecord>>>;

  constructor(private readonly runtime: MongoEnvLike) {
    this.lessonPlans = this.collection<LessonPlanRecord>("teacher_lesson_plans");
    this.diaryEntries = this.collection<TeachingDiaryRecord>("teacher_diary_entries");
    this.resources = this.collection<TeachingResourceRecord>("teacher_resources");
  }

  private async collection<
    T extends {
      tenantId: string;
      employeeId: string;
      academicYearId: string;
      subjectOfferingId: string;
      status: string;
    },
  >(name: string) {
    const collection = await getCollection<Stored<T>>(name, this.runtime);
    await collection.createIndex({ tenantId: 1, employeeId: 1, academicYearId: 1, updatedAt: -1 });
    await collection.createIndex({ tenantId: 1, subjectOfferingId: 1, status: 1, updatedAt: -1 });
    return createMongoCollectionAdapter(collection);
  }

  async listLessonPlans(tenantId: string, filter: TeacherContentPageFilter<LessonPlanStatus>) {
    return listMongo(await this.lessonPlans, tenantId, filter);
  }
  async getLessonPlan(tenantId: string, id: string) {
    return getMongo(await this.lessonPlans, tenantId, id);
  }
  async saveLessonPlan(record: LessonPlanRecord, expectedVersion?: number) {
    return saveMongo(await this.lessonPlans, record, expectedVersion);
  }
  async listDiaryEntries(tenantId: string, filter: TeacherContentPageFilter<TeachingDiaryStatus>) {
    return listMongo(await this.diaryEntries, tenantId, filter);
  }
  async getDiaryEntry(tenantId: string, id: string) {
    return getMongo(await this.diaryEntries, tenantId, id);
  }
  async saveDiaryEntry(record: TeachingDiaryRecord, expectedVersion?: number) {
    return saveMongo(await this.diaryEntries, record, expectedVersion);
  }
  async listResources(tenantId: string, filter: TeacherContentPageFilter<TeachingResourceStatus>) {
    return listMongo(await this.resources, tenantId, filter);
  }
  async getResource(tenantId: string, id: string) {
    return getMongo(await this.resources, tenantId, id);
  }
  async saveResource(record: TeachingResourceRecord, expectedVersion?: number) {
    return saveMongo(await this.resources, record, expectedVersion);
  }
}

async function listMongo<T extends TeacherContentStoredBase>(
  adapter: CollectionAdapter<Stored<T>>,
  tenantId: string,
  filter: TeacherContentPageFilter<string>,
): Promise<TeacherContentPage<T>> {
  const query = {
    tenantId,
    employeeId: filter.employeeId,
    academicYearId: filter.academicYearId,
    ...(filter.subjectOfferingId ? { subjectOfferingId: filter.subjectOfferingId } : {}),
    ...(filter.status ? { status: filter.status } : {}),
  } as TenantFilter<Stored<T>>;
  const total = await adapter.count(query);
  const documents = await adapter.findMany(query, {
    sort: { updatedAt: -1 },
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

async function getMongo<T extends TeacherContentStoredBase>(
  adapter: CollectionAdapter<Stored<T>>,
  tenantId: string,
  id: string,
): Promise<T | null> {
  const document = await adapter.findOne({ tenantId, _id: id } as TenantFilter<Stored<T>>);
  return document ? fromDocument(document) : null;
}

async function saveMongo<T extends TeacherContentStoredBase>(
  adapter: CollectionAdapter<Stored<T>>,
  record: T,
  expectedVersion?: number,
): Promise<T> {
  const document = { ...clone(record), _id: record.id } as Stored<T>;
  if (expectedVersion === undefined) return fromDocument(await adapter.insertOne(document));
  const saved = await adapter.replaceOne(
    { tenantId: record.tenantId, _id: record.id, version: expectedVersion } as TenantFilter<
      Stored<T>
    >,
    document,
  );
  if (!saved) throw new ConflictError("teacher content was changed by another user");
  return fromDocument(saved);
}

function fromDocument<T extends { tenantId: string }>(document: Stored<T>): T {
  const { _id: _ignored, ...record } = document;
  return clone(record as unknown as T);
}
const runtimeEnv = (): MongoEnvLike =>
  (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {};
let singleton: TeacherContentRepository | undefined;
export function teacherContentRepository(runtime: MongoEnvLike = runtimeEnv()) {
  if (!singleton) singleton = new MongoTeacherContentRepository(runtime);
  return singleton;
}
