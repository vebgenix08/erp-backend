import { ConflictError } from "@school-erp/errors";
import {
  createMongoCollectionAdapter,
  getCollection,
  type CollectionAdapter,
  type MongoEnvLike,
  type TenantFilter,
} from "@school-erp/mongodb";
import type {
  AcademicDoubtRecord,
  AcademicDoubtStatus,
  CourseworkRecord,
  CourseworkStatus,
  CourseworkSubmissionRecord,
  CourseworkSubmissionStatus,
  EngagementPage,
} from "./teacher-engagement.model";

export interface EngagementFilter<Status extends string> {
  teacherEmployeeId: string;
  academicYearId: string;
  subjectOfferingId?: string;
  courseworkId?: string;
  status?: Status;
  page: number;
  pageSize: number;
}

export interface TeacherEngagementRepository {
  listCoursework(
    tenantId: string,
    filter: EngagementFilter<CourseworkStatus>,
  ): Promise<EngagementPage<CourseworkRecord>>;
  getCoursework(tenantId: string, id: string): Promise<CourseworkRecord | null>;
  saveCoursework(record: CourseworkRecord, expectedVersion?: number): Promise<CourseworkRecord>;
  listSubmissions(
    tenantId: string,
    filter: EngagementFilter<CourseworkSubmissionStatus>,
  ): Promise<EngagementPage<CourseworkSubmissionRecord>>;
  getSubmission(tenantId: string, id: string): Promise<CourseworkSubmissionRecord | null>;
  saveSubmission(
    record: CourseworkSubmissionRecord,
    expectedVersion?: number,
  ): Promise<CourseworkSubmissionRecord>;
  listDoubts(
    tenantId: string,
    filter: EngagementFilter<AcademicDoubtStatus>,
  ): Promise<EngagementPage<AcademicDoubtRecord>>;
  getDoubt(tenantId: string, id: string): Promise<AcademicDoubtRecord | null>;
  saveDoubt(record: AcademicDoubtRecord, expectedVersion?: number): Promise<AcademicDoubtRecord>;
}

interface StoredBase {
  id: string;
  tenantId: string;
  academicYearId: string;
  subjectOfferingId: string;
  status: string;
  version: number;
  updatedAt: string;
}
type Stored<T extends { tenantId: string }> = T & { _id: string };
const clone = <T>(value: T): T => structuredClone(value);

function memoryPage<T extends StoredBase>(
  records: Iterable<T>,
  tenantId: string,
  filter: EngagementFilter<string>,
  teacherId: (item: T) => string,
): EngagementPage<T> {
  const rows = [...records]
    .filter(
      (item) =>
        item.tenantId === tenantId &&
        teacherId(item) === filter.teacherEmployeeId &&
        item.academicYearId === filter.academicYearId,
    )
    .filter(
      (item) => !filter.subjectOfferingId || item.subjectOfferingId === filter.subjectOfferingId,
    )
    .filter(
      (item) =>
        !filter.courseworkId ||
        (item as T & { courseworkId?: string }).courseworkId === filter.courseworkId,
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
  records: Map<string, T>,
  record: T,
  expectedVersion?: number,
) {
  const current = records.get(record.id);
  if (
    (!current && expectedVersion !== undefined) ||
    (current && (current.tenantId !== record.tenantId || current.version !== expectedVersion))
  )
    throw new ConflictError("engagement record version is stale");
  records.set(record.id, clone(record));
  return clone(record);
}

export class InMemoryTeacherEngagementRepository implements TeacherEngagementRepository {
  readonly coursework = new Map<string, CourseworkRecord>();
  readonly submissions = new Map<string, CourseworkSubmissionRecord>();
  readonly doubts = new Map<string, AcademicDoubtRecord>();
  async listCoursework(tenantId: string, filter: EngagementFilter<CourseworkStatus>) {
    return memoryPage(this.coursework.values(), tenantId, filter, (item) => item.employeeId);
  }
  async getCoursework(tenantId: string, id: string) {
    const value = this.coursework.get(id);
    return value?.tenantId === tenantId ? clone(value) : null;
  }
  async saveCoursework(record: CourseworkRecord, expectedVersion?: number) {
    return saveMemory(this.coursework, record, expectedVersion);
  }
  async listSubmissions(tenantId: string, filter: EngagementFilter<CourseworkSubmissionStatus>) {
    return memoryPage(
      this.submissions.values(),
      tenantId,
      filter,
      (item) => item.teacherEmployeeId,
    );
  }
  async getSubmission(tenantId: string, id: string) {
    const value = this.submissions.get(id);
    return value?.tenantId === tenantId ? clone(value) : null;
  }
  async saveSubmission(record: CourseworkSubmissionRecord, expectedVersion?: number) {
    return saveMemory(this.submissions, record, expectedVersion);
  }
  async listDoubts(tenantId: string, filter: EngagementFilter<AcademicDoubtStatus>) {
    return memoryPage(this.doubts.values(), tenantId, filter, (item) => item.teacherEmployeeId);
  }
  async getDoubt(tenantId: string, id: string) {
    const value = this.doubts.get(id);
    return value?.tenantId === tenantId ? clone(value) : null;
  }
  async saveDoubt(record: AcademicDoubtRecord, expectedVersion?: number) {
    return saveMemory(this.doubts, record, expectedVersion);
  }
}

export class MongoTeacherEngagementRepository implements TeacherEngagementRepository {
  private readonly coursework: Promise<CollectionAdapter<Stored<CourseworkRecord>>>;
  private readonly submissions: Promise<CollectionAdapter<Stored<CourseworkSubmissionRecord>>>;
  private readonly doubts: Promise<CollectionAdapter<Stored<AcademicDoubtRecord>>>;
  constructor(private readonly runtime: MongoEnvLike) {
    this.coursework = this.collection<CourseworkRecord>("teacher_coursework");
    this.submissions = this.collection<CourseworkSubmissionRecord>("coursework_submissions");
    this.doubts = this.collection<AcademicDoubtRecord>("academic_doubts");
  }
  private async collection<T extends StoredBase>(name: string) {
    const collection = await getCollection<Stored<T>>(name, this.runtime);
    await collection.createIndex({
      tenantId: 1,
      academicYearId: 1,
      subjectOfferingId: 1,
      status: 1,
      updatedAt: -1,
    });
    await collection.createIndex({ tenantId: 1, employeeId: 1, updatedAt: -1 }, { sparse: true });
    await collection.createIndex(
      { tenantId: 1, teacherEmployeeId: 1, updatedAt: -1 },
      { sparse: true },
    );
    return createMongoCollectionAdapter(collection);
  }
  async listCoursework(tenantId: string, filter: EngagementFilter<CourseworkStatus>) {
    return mongoPage(await this.coursework, tenantId, filter, "employeeId");
  }
  async getCoursework(tenantId: string, id: string) {
    return mongoGet(await this.coursework, tenantId, id);
  }
  async saveCoursework(record: CourseworkRecord, expectedVersion?: number) {
    return mongoSave(await this.coursework, record, expectedVersion);
  }
  async listSubmissions(tenantId: string, filter: EngagementFilter<CourseworkSubmissionStatus>) {
    return mongoPage(await this.submissions, tenantId, filter, "teacherEmployeeId");
  }
  async getSubmission(tenantId: string, id: string) {
    return mongoGet(await this.submissions, tenantId, id);
  }
  async saveSubmission(record: CourseworkSubmissionRecord, expectedVersion?: number) {
    return mongoSave(await this.submissions, record, expectedVersion);
  }
  async listDoubts(tenantId: string, filter: EngagementFilter<AcademicDoubtStatus>) {
    return mongoPage(await this.doubts, tenantId, filter, "teacherEmployeeId");
  }
  async getDoubt(tenantId: string, id: string) {
    return mongoGet(await this.doubts, tenantId, id);
  }
  async saveDoubt(record: AcademicDoubtRecord, expectedVersion?: number) {
    return mongoSave(await this.doubts, record, expectedVersion);
  }
}

async function mongoPage<T extends StoredBase>(
  adapter: CollectionAdapter<Stored<T>>,
  tenantId: string,
  filter: EngagementFilter<string>,
  teacherField: "employeeId" | "teacherEmployeeId",
): Promise<EngagementPage<T>> {
  const query = {
    tenantId,
    [teacherField]: filter.teacherEmployeeId,
    academicYearId: filter.academicYearId,
    ...(filter.subjectOfferingId ? { subjectOfferingId: filter.subjectOfferingId } : {}),
    ...(filter.courseworkId ? { courseworkId: filter.courseworkId } : {}),
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
async function mongoGet<T extends StoredBase>(
  adapter: CollectionAdapter<Stored<T>>,
  tenantId: string,
  id: string,
) {
  const value = await adapter.findOne({ tenantId, _id: id } as TenantFilter<Stored<T>>);
  return value ? fromDocument(value) : null;
}
async function mongoSave<T extends StoredBase>(
  adapter: CollectionAdapter<Stored<T>>,
  record: T,
  expectedVersion?: number,
) {
  const document = { ...clone(record), _id: record.id } as Stored<T>;
  if (expectedVersion === undefined) return fromDocument(await adapter.insertOne(document));
  const value = await adapter.replaceOne(
    { tenantId: record.tenantId, _id: record.id, version: expectedVersion } as TenantFilter<
      Stored<T>
    >,
    document,
  );
  if (!value) throw new ConflictError("engagement record was changed by another user");
  return fromDocument(value);
}
function fromDocument<T extends { tenantId: string }>(document: Stored<T>): T {
  const { _id: _ignored, ...record } = document;
  return clone(record as unknown as T);
}
const runtimeEnv = (): MongoEnvLike =>
  (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {};
let singleton: TeacherEngagementRepository | undefined;
export function teacherEngagementRepository(runtime: MongoEnvLike = runtimeEnv()) {
  return (singleton ??= new MongoTeacherEngagementRepository(runtime));
}
