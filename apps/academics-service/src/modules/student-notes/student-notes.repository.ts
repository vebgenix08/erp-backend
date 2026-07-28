import { BadRequestError } from "@school-erp/errors";
import { createMongoCollectionAdapter, getCollection, type CollectionAdapter, type MongoEnvLike } from "@school-erp/mongodb";
import type { StudentNoteRecord } from "./student-notes.model";

interface StudentNoteDocument extends StudentNoteRecord { _id: string }
export interface StudentNoteRepository {
  list(tenantId: string, studentId: string): Promise<StudentNoteRecord[]>;
  create(record: StudentNoteRecord): Promise<StudentNoteRecord>;
  update(tenantId: string, id: string, body: string, updatedAt: Date): Promise<StudentNoteRecord | null>;
}

const required = (value: string, field: string) => {
  const normalized = value.trim();
  if (!normalized) throw new BadRequestError(`${field} is required`);
  return normalized;
};
const clone = (record: StudentNoteRecord): StudentNoteRecord => ({
  ...record,
  createdAt: new Date(record.createdAt),
  updatedAt: new Date(record.updatedAt),
});

export class InMemoryStudentNoteRepository implements StudentNoteRepository {
  private readonly records = new Map<string, StudentNoteRecord>();
  async list(tenantId: string, studentId: string) {
    const tid = required(tenantId, "tenantId");
    return [...this.records.values()]
      .filter((item) => item.tenantId === tid && item.studentId === studentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(clone);
  }
  async create(record: StudentNoteRecord) {
    this.records.set(record.id, clone(record));
    return clone(record);
  }
  async update(tenantId: string, id: string, body: string, updatedAt: Date) {
    const current = this.records.get(id);
    if (!current || current.tenantId !== required(tenantId, "tenantId")) return null;
    const next = { ...current, body, updatedAt };
    this.records.set(id, next);
    return clone(next);
  }
}

class MongoStudentNoteRepository implements StudentNoteRepository {
  constructor(private readonly collection: CollectionAdapter<StudentNoteDocument>) {}
  async list(tenantId: string, studentId: string) {
    return (await this.collection.findMany(
      { tenantId: required(tenantId, "tenantId"), studentId },
      { sort: { createdAt: -1 } },
    )).map(({ _id, ...record }) => clone({ ...record, id: record.id || _id }));
  }
  async create(record: StudentNoteRecord) {
    await this.collection.insertOne({ ...clone(record), _id: record.id });
    return clone(record);
  }
  async update(tenantId: string, id: string, body: string, updatedAt: Date) {
    const current = await this.collection.findOne({ tenantId: required(tenantId, "tenantId"), _id: id });
    if (!current) return null;
    const next = { ...current, body, updatedAt };
    return await this.collection.replaceOne({ tenantId, _id: id }, next)
      ? clone(next)
      : null;
  }
}

const runtimeEnv = (): MongoEnvLike =>
  (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {};
let singleton: Promise<StudentNoteRepository> | undefined;
export async function createStudentNoteRepository(env: MongoEnvLike = runtimeEnv()) {
  if (!env.MONGODB_URI && !env.MONGODB_URI_DEV && !env.MONGODB_URI_PROD && !env.MONGODB_URI_TEST)
    return new InMemoryStudentNoteRepository();
  const collection = await getCollection<StudentNoteDocument>("academics_student_notes", env);
  await collection.createIndex({ tenantId: 1, studentId: 1, createdAt: -1 });
  return new MongoStudentNoteRepository(createMongoCollectionAdapter(collection));
}
export function getStudentNoteRepository() {
  return singleton ??= createStudentNoteRepository();
}
