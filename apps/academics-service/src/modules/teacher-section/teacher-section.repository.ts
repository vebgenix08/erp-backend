import { ConflictError } from "@school-erp/errors";
import {
  createMongoCollectionAdapter,
  getCollection,
  type CollectionAdapter,
  type MongoEnvLike,
  type TenantFilter,
} from "@school-erp/mongodb";
import type { SectionStudentFollowUp } from "./teacher-section.model";

type Stored = SectionStudentFollowUp & { _id: string };
const clone = <T>(value: T): T => structuredClone(value);
export interface TeacherSectionRepository {
  listFollowUps(
    tenantId: string,
    employeeId: string,
    academicYearId: string,
    sectionId: string,
  ): Promise<SectionStudentFollowUp[]>;
  getFollowUp(tenantId: string, id: string): Promise<SectionStudentFollowUp | null>;
  saveFollowUp(
    record: SectionStudentFollowUp,
    expectedVersion?: number,
  ): Promise<SectionStudentFollowUp>;
}

export class InMemoryTeacherSectionRepository implements TeacherSectionRepository {
  readonly followUps = new Map<string, SectionStudentFollowUp>();
  async listFollowUps(
    tenantId: string,
    employeeId: string,
    academicYearId: string,
    sectionId: string,
  ) {
    return [...this.followUps.values()]
      .filter(
        (item) =>
          item.tenantId === tenantId &&
          item.employeeId === employeeId &&
          item.academicYearId === academicYearId &&
          item.sectionId === sectionId,
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(clone);
  }
  async getFollowUp(tenantId: string, id: string) {
    const item = this.followUps.get(id);
    return item?.tenantId === tenantId ? clone(item) : null;
  }
  async saveFollowUp(record: SectionStudentFollowUp, expectedVersion?: number) {
    const current = this.followUps.get(record.id);
    if (
      (!current && expectedVersion !== undefined) ||
      (current && (current.tenantId !== record.tenantId || current.version !== expectedVersion))
    )
      throw new ConflictError("section follow-up version is stale");
    this.followUps.set(record.id, clone(record));
    return clone(record);
  }
}

export class MongoTeacherSectionRepository implements TeacherSectionRepository {
  private readonly collection: Promise<CollectionAdapter<Stored>>;
  constructor(runtime: MongoEnvLike) {
    this.collection = this.create(runtime);
  }
  private async create(runtime: MongoEnvLike) {
    const collection = await getCollection<Stored>("section_student_followups", runtime);
    await collection.createIndex({
      tenantId: 1,
      employeeId: 1,
      academicYearId: 1,
      sectionId: 1,
      status: 1,
      updatedAt: -1,
    });
    await collection.createIndex({ tenantId: 1, studentId: 1, status: 1, updatedAt: -1 });
    return createMongoCollectionAdapter(collection);
  }
  async listFollowUps(
    tenantId: string,
    employeeId: string,
    academicYearId: string,
    sectionId: string,
  ) {
    return (
      await (
        await this.collection
      ).findMany({ tenantId, employeeId, academicYearId, sectionId } as TenantFilter<Stored>, {
        sort: { updatedAt: -1 },
      })
    ).map(fromDocument);
  }
  async getFollowUp(tenantId: string, id: string) {
    const item = await (
      await this.collection
    ).findOne({ tenantId, _id: id } as TenantFilter<Stored>);
    return item ? fromDocument(item) : null;
  }
  async saveFollowUp(record: SectionStudentFollowUp, expectedVersion?: number) {
    const adapter = await this.collection;
    const document = { ...clone(record), _id: record.id };
    if (expectedVersion === undefined) return fromDocument(await adapter.insertOne(document));
    const saved = await adapter.replaceOne(
      {
        tenantId: record.tenantId,
        _id: record.id,
        version: expectedVersion,
      } as TenantFilter<Stored>,
      document,
    );
    if (!saved) throw new ConflictError("section follow-up was changed by another user");
    return fromDocument(saved);
  }
}
function fromDocument(document: Stored): SectionStudentFollowUp {
  const { _id: _ignored, ...record } = document;
  return clone(record);
}
const runtimeEnv = (): MongoEnvLike =>
  (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {};
let singleton: TeacherSectionRepository | undefined;
export function teacherSectionRepository(runtime: MongoEnvLike = runtimeEnv()) {
  return (singleton ??= new MongoTeacherSectionRepository(runtime));
}
