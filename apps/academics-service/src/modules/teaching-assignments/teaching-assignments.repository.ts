import { ConflictError } from "@school-erp/errors";
import { getMongoConnection, type MongoEnvLike } from "@school-erp/mongodb";
import type { Collection } from "mongodb";
import type { TeachingAssignmentFilter, TeachingAssignmentInput, TeachingAssignmentRecord } from "./teaching-assignments.model";

export interface TeachingAssignmentRepository {
  list(tenantId: string, filter: TeachingAssignmentFilter): Promise<TeachingAssignmentRecord[]>;
  create(tenantId: string, actorId: string, input: TeachingAssignmentInput): Promise<TeachingAssignmentRecord>;
  deactivate(tenantId: string, id: string): Promise<TeachingAssignmentRecord | null>;
}
interface Document extends TeachingAssignmentRecord { _id: string }
const clone = (record: TeachingAssignmentRecord): TeachingAssignmentRecord => ({ ...record, createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt), ...(record.deactivatedAt ? { deactivatedAt: new Date(record.deactivatedAt) } : {}) });
const key = (value: TeachingAssignmentInput) => [value.campusId, value.academicYearId, value.role, value.classId, value.sectionId, value.subjectId ?? "", value.employeeId].join(":");
const matches = (record: TeachingAssignmentRecord, filter: TeachingAssignmentFilter) =>
  record.campusId === filter.campusId &&
  (!filter.academicYearId || record.academicYearId === filter.academicYearId) &&
  (!filter.employeeId || record.employeeId === filter.employeeId) &&
  (!filter.classId || record.classId === filter.classId) &&
  (!filter.sectionId || record.sectionId === filter.sectionId) &&
  (!filter.subjectId || record.subjectId === filter.subjectId) &&
  (!filter.role || record.role === filter.role) &&
  (!filter.status || record.status === filter.status);

export class InMemoryTeachingAssignmentRepository implements TeachingAssignmentRepository {
  private records = new Map<string, TeachingAssignmentRecord>();
  async list(tenantId: string, filter: TeachingAssignmentFilter) { return [...this.records.values()].filter((item) => item.tenantId === tenantId && matches(item, filter)).map(clone); }
  async create(tenantId: string, actorId: string, input: TeachingAssignmentInput) {
    const duplicate = [...this.records.values()].find((item) => item.tenantId === tenantId && item.status === "ACTIVE" && key(item) === key(input));
    if (duplicate) throw new ConflictError("this teaching assignment already exists");
    if (input.role === "SECTION_INCHARGE") {
      const owner = [...this.records.values()].find((item) => item.tenantId === tenantId && item.status === "ACTIVE" && item.role === "SECTION_INCHARGE" && item.academicYearId === input.academicYearId && item.sectionId === input.sectionId);
      if (owner) throw new ConflictError("section already has an active in-charge");
    }
    const at = new Date();
    const record: TeachingAssignmentRecord = { id: `teaching_assignment_${crypto.randomUUID()}`, tenantId, ...input, status: "ACTIVE", createdBy: actorId, createdAt: at, updatedAt: at };
    this.records.set(record.id, clone(record)); return clone(record);
  }
  async deactivate(tenantId: string, id: string) { const current = this.records.get(id); if (!current || current.tenantId !== tenantId) return null; const at = new Date(); const record: TeachingAssignmentRecord = { ...current, status: "INACTIVE", updatedAt: at, deactivatedAt: at }; this.records.set(id, clone(record)); return clone(record); }
}
class MongoTeachingAssignmentRepository implements TeachingAssignmentRepository {
  constructor(private collection: Collection<Document>) {}
  async list(tenantId: string, filter: TeachingAssignmentFilter) {
    const query: Record<string, unknown> = { tenantId, campusId: filter.campusId };
    for (const field of ["academicYearId", "employeeId", "classId", "sectionId", "subjectId", "role", "status"] as const) if (filter[field]) query[field] = filter[field];
    return (await this.collection.find(query).sort({ employeeName: 1 }).toArray()).map(clone);
  }
  async create(tenantId: string, actorId: string, input: TeachingAssignmentInput) {
    const active = await this.collection.findOne({ tenantId, status: "ACTIVE", campusId: input.campusId, academicYearId: input.academicYearId, role: input.role, classId: input.classId, sectionId: input.sectionId, subjectId: input.subjectId ?? { $exists: false }, employeeId: input.employeeId });
    if (active) throw new ConflictError("this teaching assignment already exists");
    if (input.role === "SECTION_INCHARGE" && await this.collection.findOne({ tenantId, status: "ACTIVE", academicYearId: input.academicYearId, sectionId: input.sectionId, role: "SECTION_INCHARGE" })) throw new ConflictError("section already has an active in-charge");
    const at = new Date(); const record: TeachingAssignmentRecord = { id: `teaching_assignment_${crypto.randomUUID()}`, tenantId, ...input, status: "ACTIVE", createdBy: actorId, createdAt: at, updatedAt: at };
    await this.collection.insertOne({ ...record, _id: record.id }); return clone(record);
  }
  async deactivate(tenantId: string, id: string) { const at = new Date(); const result = await this.collection.findOneAndUpdate({ _id: id, tenantId }, { $set: { status: "INACTIVE", updatedAt: at, deactivatedAt: at } }, { returnDocument: "after" }); return result ? clone(result) : null; }
}
let singleton: Promise<TeachingAssignmentRepository> | undefined;
export function teachingAssignmentRepository(): Promise<TeachingAssignmentRepository> {
  singleton ??= (async () => {
    const env = (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {};
    if (!env.MONGODB_URI && !env.MONGODB_URI_DEV && !env.MONGODB_URI_PROD && !env.MONGODB_URI_TEST) return new InMemoryTeachingAssignmentRepository();
    const connection = await getMongoConnection(env); const collection = connection.client.db(connection.dbName).collection<Document>("teaching_assignments");
    await collection.createIndex({ tenantId: 1, campusId: 1, academicYearId: 1, status: 1 });
    return new MongoTeachingAssignmentRepository(collection);
  })();
  return singleton;
}
