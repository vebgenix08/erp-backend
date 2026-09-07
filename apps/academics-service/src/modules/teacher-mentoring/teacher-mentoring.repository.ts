import { ConflictError } from "@school-erp/errors";
import {
  createMongoCollectionAdapter,
  getCollection,
  type CollectionAdapter,
  type MongoEnvLike,
  type TenantFilter,
} from "@school-erp/mongodb";
import type { MentorInteraction, StudentMentorAssignment } from "./teacher-mentoring.model";

type Stored<T extends { tenantId: string }> = T & { _id: string };
const clone = <T>(value: T): T => structuredClone(value);

export interface TeacherMentoringRepository {
  listAssignments(
    tenantId: string,
    mentorEmployeeId: string,
    academicYearId: string,
  ): Promise<StudentMentorAssignment[]>;
  listAssignmentsForMentors(
    tenantId: string,
    mentorEmployeeIds: string[],
    academicYearId: string,
  ): Promise<StudentMentorAssignment[]>;
  getAssignment(tenantId: string, id: string): Promise<StudentMentorAssignment | null>;
  findActiveAssignment(
    tenantId: string,
    studentId: string,
    academicYearId: string,
  ): Promise<StudentMentorAssignment | null>;
  saveAssignment(
    record: StudentMentorAssignment,
    expectedVersion?: number,
  ): Promise<StudentMentorAssignment>;
  listInteractions(tenantId: string, assignmentId: string): Promise<MentorInteraction[]>;
  getInteraction(tenantId: string, id: string): Promise<MentorInteraction | null>;
  saveInteraction(record: MentorInteraction, expectedVersion?: number): Promise<MentorInteraction>;
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
    throw new ConflictError("mentoring record version is stale");
  records.set(record.id, clone(record));
  return clone(record);
}

export class InMemoryTeacherMentoringRepository implements TeacherMentoringRepository {
  readonly assignments = new Map<string, StudentMentorAssignment>();
  readonly interactions = new Map<string, MentorInteraction>();
  async listAssignments(tenantId: string, mentorEmployeeId: string, academicYearId: string) {
    return [...this.assignments.values()]
      .filter(
        (item) =>
          item.tenantId === tenantId &&
          item.mentorEmployeeId === mentorEmployeeId &&
          item.academicYearId === academicYearId &&
          item.status === "ACTIVE",
      )
      .map(clone);
  }
  async listAssignmentsForMentors(
    tenantId: string,
    mentorEmployeeIds: string[],
    academicYearId: string,
  ) {
    const mentorIds = new Set(mentorEmployeeIds);
    return [...this.assignments.values()]
      .filter(
        (item) =>
          item.tenantId === tenantId &&
          mentorIds.has(item.mentorEmployeeId) &&
          item.academicYearId === academicYearId &&
          item.status === "ACTIVE",
      )
      .map(clone);
  }
  async getAssignment(tenantId: string, id: string) {
    const item = this.assignments.get(id);
    return item?.tenantId === tenantId ? clone(item) : null;
  }
  async findActiveAssignment(tenantId: string, studentId: string, academicYearId: string) {
    const item = [...this.assignments.values()].find(
      (value) =>
        value.tenantId === tenantId &&
        value.studentId === studentId &&
        value.academicYearId === academicYearId &&
        value.status === "ACTIVE",
    );
    return item ? clone(item) : null;
  }
  async saveAssignment(record: StudentMentorAssignment, expectedVersion?: number) {
    return saveMemory(this.assignments, record, expectedVersion);
  }
  async listInteractions(tenantId: string, assignmentId: string) {
    return [...this.interactions.values()]
      .filter((item) => item.tenantId === tenantId && item.assignmentId === assignmentId)
      .sort(
        (a, b) =>
          b.interactionDate.localeCompare(a.interactionDate) ||
          b.updatedAt.localeCompare(a.updatedAt),
      )
      .map(clone);
  }
  async getInteraction(tenantId: string, id: string) {
    const item = this.interactions.get(id);
    return item?.tenantId === tenantId ? clone(item) : null;
  }
  async saveInteraction(record: MentorInteraction, expectedVersion?: number) {
    return saveMemory(this.interactions, record, expectedVersion);
  }
}

export class MongoTeacherMentoringRepository implements TeacherMentoringRepository {
  private readonly assignments: Promise<CollectionAdapter<Stored<StudentMentorAssignment>>>;
  private readonly interactions: Promise<CollectionAdapter<Stored<MentorInteraction>>>;
  constructor(private readonly runtime: MongoEnvLike) {
    this.assignments = this.collection<StudentMentorAssignment>("student_mentor_assignments");
    this.interactions = this.collection<MentorInteraction>("mentor_interactions");
  }
  private async collection<T extends { tenantId: string }>(name: string) {
    const collection = await getCollection<Stored<T>>(name, this.runtime);
    if (name === "student_mentor_assignments") {
      await collection.createIndex({
        tenantId: 1,
        mentorEmployeeId: 1,
        academicYearId: 1,
        status: 1,
      });
      await collection.createIndex({ tenantId: 1, studentId: 1, academicYearId: 1, status: 1 });
    } else {
      await collection.createIndex({ tenantId: 1, assignmentId: 1, interactionDate: -1 });
      await collection.createIndex({
        tenantId: 1,
        mentorEmployeeId: 1,
        status: 1,
        followUpDate: 1,
      });
    }
    return createMongoCollectionAdapter(collection);
  }
  async listAssignments(tenantId: string, mentorEmployeeId: string, academicYearId: string) {
    return (
      await (
        await this.assignments
      ).findMany(
        { tenantId, mentorEmployeeId, academicYearId, status: "ACTIVE" } as TenantFilter<
          Stored<StudentMentorAssignment>
        >,
        { sort: { updatedAt: -1 } },
      )
    ).map(fromDocument);
  }
  async listAssignmentsForMentors(
    tenantId: string,
    mentorEmployeeIds: string[],
    academicYearId: string,
  ) {
    if (!mentorEmployeeIds.length) return [];
    return (
      await (
        await this.assignments
      ).findMany(
        {
          tenantId,
          mentorEmployeeId: { $in: mentorEmployeeIds },
          academicYearId,
          status: "ACTIVE",
        } as TenantFilter<Stored<StudentMentorAssignment>>,
        { sort: { updatedAt: -1 } },
      )
    ).map(fromDocument);
  }
  async getAssignment(tenantId: string, id: string) {
    const item = await (
      await this.assignments
    ).findOne({ tenantId, _id: id } as TenantFilter<Stored<StudentMentorAssignment>>);
    return item ? fromDocument(item) : null;
  }
  async findActiveAssignment(tenantId: string, studentId: string, academicYearId: string) {
    const item = await (
      await this.assignments
    ).findOne({ tenantId, studentId, academicYearId, status: "ACTIVE" } as TenantFilter<
      Stored<StudentMentorAssignment>
    >);
    return item ? fromDocument(item) : null;
  }
  async saveAssignment(record: StudentMentorAssignment, expectedVersion?: number) {
    return saveMongo(await this.assignments, record, expectedVersion);
  }
  async listInteractions(tenantId: string, assignmentId: string) {
    return (
      await (
        await this.interactions
      ).findMany({ tenantId, assignmentId } as TenantFilter<Stored<MentorInteraction>>, {
        sort: { interactionDate: -1, updatedAt: -1 },
      })
    ).map(fromDocument);
  }
  async getInteraction(tenantId: string, id: string) {
    const item = await (
      await this.interactions
    ).findOne({ tenantId, _id: id } as TenantFilter<Stored<MentorInteraction>>);
    return item ? fromDocument(item) : null;
  }
  async saveInteraction(record: MentorInteraction, expectedVersion?: number) {
    return saveMongo(await this.interactions, record, expectedVersion);
  }
}

async function saveMongo<T extends { id: string; tenantId: string; version: number }>(
  adapter: CollectionAdapter<Stored<T>>,
  record: T,
  expectedVersion?: number,
) {
  const document = { ...clone(record), _id: record.id } as Stored<T>;
  if (expectedVersion === undefined) return fromDocument(await adapter.insertOne(document));
  const saved = await adapter.replaceOne(
    { tenantId: record.tenantId, _id: record.id, version: expectedVersion } as TenantFilter<
      Stored<T>
    >,
    document,
  );
  if (!saved) throw new ConflictError("mentoring record was changed by another user");
  return fromDocument(saved);
}
function fromDocument<T extends { tenantId: string }>(document: Stored<T>): T {
  const { _id: _ignored, ...record } = document;
  return clone(record as unknown as T);
}
const runtimeEnv = (): MongoEnvLike =>
  (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {};
let singleton: TeacherMentoringRepository | undefined;
export function teacherMentoringRepository(runtime: MongoEnvLike = runtimeEnv()) {
  return (singleton ??= new MongoTeacherMentoringRepository(runtime));
}
