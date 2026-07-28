import { BadRequestError } from "@school-erp/errors";
import {
  createMongoCollectionAdapter,
  getCollection,
  type CollectionAdapter,
  type MongoEnvLike,
} from "@school-erp/mongodb";
import { normalizeTenantId } from "@school-erp/tenancy";
import type {
  ApplicationCreateInput,
  ApplicationListFilter,
  ApplicationPage,
  ApplicationRecord,
} from "./application.model";

export interface ApplicationRepository {
  list(
    tenantId: string,
    filter?: ApplicationListFilter,
  ): Promise<ApplicationRecord[]>;
  listPage(tenantId: string, filter: ApplicationListFilter): Promise<ApplicationPage>;
  getById(tenantId: string, id: string): Promise<ApplicationRecord | null>;
  getByEnquiryId(
    tenantId: string,
    enquiryId: string,
  ): Promise<ApplicationRecord | null>;
  findPotentialDuplicates(
    tenantId: string,
    applicationId: string,
  ): Promise<ApplicationRecord[]>;
  nextApplicationSequence(
    tenantId: string,
    academicYearId: string,
  ): Promise<number>;
  nextAdmissionSequence(
    tenantId: string,
    academicYearId: string,
  ): Promise<number>;
  create(
    tenantId: string,
    input: ApplicationCreateInput &
      Pick<
        ApplicationRecord,
        | "id"
        | "status"
        | "createdBy"
        | "createdAt"
        | "updatedAt"
        | "stageHistory"
        | "reviews"
        | "pendingEvents"
      >,
  ): Promise<ApplicationRecord>;
  replace(
    tenantId: string,
    record: ApplicationRecord,
  ): Promise<ApplicationRecord | null>;
}

function normalized(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}
function phone(value?: string) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length > 10 ? digits.slice(-10) : digits;
}
function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function duplicateOf(candidate: ApplicationRecord, source: ApplicationRecord) {
  if (candidate.id === source.id || candidate.status === "CANCELLED")
    return false;
  if (phone(source.phone) && phone(candidate.phone) === phone(source.phone))
    return true;
  if (
    normalized(source.email) &&
    normalized(candidate.email) === normalized(source.email)
  )
    return true;
  return Boolean(
    source.dateOfBirth &&
      candidate.dateOfBirth &&
      normalized(candidate.studentName) === normalized(source.studentName) &&
      candidate.dateOfBirth.toISOString().slice(0, 10) ===
        source.dateOfBirth.toISOString().slice(0, 10),
  );
}

function tenant(tenantId: string): string {
  const value = normalizeTenantId(tenantId);
  if (!value) throw new BadRequestError("tenantId is required");
  return value;
}
function clone(record: ApplicationRecord): ApplicationRecord {
  return {
    ...record,
    dateOfBirth: record.dateOfBirth ? new Date(record.dateOfBirth) : undefined,
    customFields: record.customFields ? { ...record.customFields } : undefined,
    documents: record.documents.map((item) => ({ ...item })),
    reviews: record.reviews.map((item) => ({
      ...item,
      reviewedAt: new Date(item.reviewedAt),
    })),
    stageHistory: record.stageHistory.map((item) => ({
      ...item,
      at: new Date(item.at),
    })),
    pendingEvents: (record.pendingEvents ?? []).map((event) =>
      structuredClone(event),
    ),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    submittedAt: record.submittedAt ? new Date(record.submittedAt) : undefined,
    approvedAt: record.approvedAt ? new Date(record.approvedAt) : undefined,
    rejectedAt: record.rejectedAt ? new Date(record.rejectedAt) : undefined,
    confirmedAt: record.confirmedAt ? new Date(record.confirmedAt) : undefined,
    cancelledAt: record.cancelledAt ? new Date(record.cancelledAt) : undefined,
  };
}
function match(
  record: ApplicationRecord,
  filter?: ApplicationListFilter,
): boolean {
  if (filter?.status && record.status !== filter.status) return false;
  if (filter?.campusId && record.campusId !== filter.campusId) return false;
  if (filter?.academicYearId && record.academicYearId !== filter.academicYearId)
    return false;
  if (
    filter?.academicTargetId &&
    record.academicTargetId !== filter.academicTargetId
  )
    return false;
  if (filter?.search) {
    const needle = filter.search.toLowerCase();
    const haystack = [
      record.applicationNumber,
      record.studentName,
      record.parentName,
      record.phone,
      record.email,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

export class InMemoryApplicationRepository implements ApplicationRepository {
  private readonly records = new Map<string, Map<string, ApplicationRecord>>();
  private readonly sequences = new Map<string, number>();
  private bucket(tenantId: string) {
    const key = tenant(tenantId);
    let value = this.records.get(key);
    if (!value) {
      value = new Map();
      this.records.set(key, value);
    }
    return value;
  }
  async list(tenantId: string, filter?: ApplicationListFilter) {
    return [...this.bucket(tenantId).values()]
      .filter((item) => match(item, filter))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(clone);
  }
  async listPage(tenantId: string, filter: ApplicationListFilter) {
    const matches = (await this.list(tenantId, filter));
    const page = filter.page ?? 1, pageSize = filter.pageSize ?? 25;
    const total = matches.length;
    return {
      items: matches.slice((page - 1) * pageSize, page * pageSize),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }
  async getById(tenantId: string, id: string) {
    const value = this.bucket(tenantId).get(id);
    return value ? clone(value) : null;
  }
  async getByEnquiryId(tenantId: string, enquiryId: string) {
    const value = [...this.bucket(tenantId).values()].find(
      (item) => item.enquiryId === enquiryId && item.status !== "CANCELLED",
    );
    return value ? clone(value) : null;
  }
  async findPotentialDuplicates(tenantId: string, applicationId: string) {
    const source = await this.getById(tenantId, applicationId);
    if (!source) return [];
    return [...this.bucket(tenantId).values()]
      .filter((item) => duplicateOf(item, source))
      .map(clone);
  }
  async nextApplicationSequence(tenantId: string, academicYearId: string) {
    const key = `${tenant(tenantId)}:${academicYearId}`;
    const value = (this.sequences.get(key) ?? 0) + 1;
    this.sequences.set(key, value);
    return value;
  }
  async nextAdmissionSequence(tenantId: string, academicYearId: string) {
    const key = `admission:${tenant(tenantId)}:${academicYearId}`;
    const value = (this.sequences.get(key) ?? 0) + 1;
    this.sequences.set(key, value);
    return value;
  }
  async create(
    tenantId: string,
    input: Parameters<ApplicationRepository["create"]>[1],
  ) {
    const record: ApplicationRecord = { ...input, tenantId: tenant(tenantId) };
    this.bucket(tenantId).set(record.id, clone(record));
    return clone(record);
  }
  async replace(tenantId: string, record: ApplicationRecord) {
    const bucket = this.bucket(tenantId);
    if (!bucket.has(record.id)) return null;
    const safe = { ...record, tenantId: tenant(tenantId) };
    bucket.set(record.id, clone(safe));
    return clone(safe);
  }
}

interface ApplicationDocument extends ApplicationRecord {
  _id: string;
}
interface SequenceDocument {
  _id: string;
  value: number;
}
function toDocument(record: ApplicationRecord): ApplicationDocument {
  return { ...clone(record), _id: record.id };
}
function fromDocument(
  document: ApplicationDocument | null,
): ApplicationRecord | null {
  if (!document) return null;
  const { _id, ...record } = document;
  return clone({ ...record, id: record.id || _id });
}

class MongoApplicationRepository implements ApplicationRepository {
  constructor(
    private readonly collection: CollectionAdapter<ApplicationDocument>,
    private readonly sequences: Awaited<
      ReturnType<typeof getCollection<SequenceDocument>>
    >,
  ) {}
  async list(tenantId: string, filter?: ApplicationListFilter) {
    const records = (
      await this.collection.findMany({ tenantId: tenant(tenantId) })
    )
      .map(fromDocument)
      .filter((item): item is ApplicationRecord => Boolean(item));
    return records
      .filter((item) => match(item, filter))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async listPage(tenantId: string, filter: ApplicationListFilter) {
    const query: Record<string, unknown> = { tenantId: tenant(tenantId) };
    if (filter.status) query.status = filter.status;
    if (filter.campusId) query.campusId = filter.campusId;
    if (filter.academicYearId) query.academicYearId = filter.academicYearId;
    if (filter.academicTargetId) query.academicTargetId = filter.academicTargetId;
    if (filter.search) {
      const expression = { $regex: escaped(filter.search), $options: "i" };
      query.$or = [
        { applicationNumber: expression },
        { studentName: expression },
        { parentName: expression },
        { phone: expression },
        { email: expression },
      ];
    }
    const page = filter.page ?? 1, pageSize = filter.pageSize ?? 25;
    const [documents, total] = await Promise.all([
      this.collection.findMany(query, {
        sort: { createdAt: -1, _id: -1 },
        skip: (page - 1) * pageSize,
        limit: pageSize,
      }),
      this.collection.count(query),
    ]);
    return {
      items: documents.map(fromDocument).filter((item): item is ApplicationRecord => Boolean(item)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }
  async getById(tenantId: string, id: string) {
    return fromDocument(
      await this.collection.findOne({ tenantId: tenant(tenantId), _id: id }),
    );
  }
  async getByEnquiryId(tenantId: string, enquiryId: string) {
    const records = await this.list(tenantId);
    return (
      records.find(
        (item) => item.enquiryId === enquiryId && item.status !== "CANCELLED",
      ) ?? null
    );
  }
  async findPotentialDuplicates(tenantId: string, applicationId: string) {
    const source = await this.getById(tenantId, applicationId);
    if (!source) return [];
    const sourcePhone = phone(source.phone);
    const candidates = await this.collection.findMany({
      tenantId: tenant(tenantId),
      _id: { $ne: applicationId },
      status: { $ne: "CANCELLED" },
      $or: [
        ...(sourcePhone
          ? [
              {
                phone: {
                  $regex: `${sourcePhone.split("").map(escaped).join("\\D*")}$`,
                },
              },
            ]
          : []),
        ...(source.email
          ? [
              {
                email: {
                  $regex: `^${escaped(source.email.trim())}$`,
                  $options: "i",
                },
              },
            ]
          : []),
        ...(source.dateOfBirth
          ? [
              {
                studentName: source.studentName,
                dateOfBirth: source.dateOfBirth,
              },
            ]
          : []),
      ],
    });
    return candidates
      .map(fromDocument)
      .filter((item): item is ApplicationRecord => Boolean(item))
      .filter((item) => duplicateOf(item, source));
  }
  async nextApplicationSequence(tenantId: string, academicYearId: string) {
    const result = await this.sequences.findOneAndUpdate(
      { _id: `application:${tenant(tenantId)}:${academicYearId}` },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return result?.value ?? 1;
  }
  async nextAdmissionSequence(tenantId: string, academicYearId: string) {
    const result = await this.sequences.findOneAndUpdate(
      { _id: `admission:${tenant(tenantId)}:${academicYearId}` },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return result?.value ?? 1;
  }
  async create(
    tenantId: string,
    input: Parameters<ApplicationRepository["create"]>[1],
  ) {
    const record: ApplicationRecord = { ...input, tenantId: tenant(tenantId) };
    await this.collection.insertOne(toDocument(record));
    return clone(record);
  }
  async replace(tenantId: string, record: ApplicationRecord) {
    const safe = { ...record, tenantId: tenant(tenantId) };
    return (await this.collection.replaceOne(
      { tenantId: safe.tenantId, _id: safe.id },
      toDocument(safe),
    ))
      ? clone(safe)
      : null;
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
export async function createApplicationRepository(
  env: MongoEnvLike = runtimeEnv(),
): Promise<ApplicationRepository> {
  if (!hasMongo(env)) return new InMemoryApplicationRepository();
  const collection = await getCollection<ApplicationDocument>(
      "admissions_applications",
      env,
    ),
    sequences = await getCollection<SequenceDocument>(
      "admissions_sequences",
      env,
    );
  try {
    await collection.dropIndex("tenantId_1_applicationNumber_1");
  } catch (error) {
    const codeName = error && typeof error === "object" && "codeName" in error ? error.codeName : undefined;
    if (codeName !== "IndexNotFound") throw error;
  }
  await collection.createIndex(
    { tenantId: 1, applicationNumber: 1 },
    {
      name: "uq_tenant_application_number",
      unique: true,
      partialFilterExpression: { applicationNumber: { $type: "string" } },
    },
  );
  await collection.createIndex({ tenantId: 1, status: 1, createdAt: -1 });
  await collection.createIndex({ tenantId: 1, enquiryId: 1 }, { sparse: true });
  await collection.createIndex({ tenantId: 1, campusId: 1, academicYearId: 1 });
  return new MongoApplicationRepository(
    createMongoCollectionAdapter(collection),
    sequences,
  );
}
let singleton: Promise<ApplicationRepository> | undefined;
function repository() {
  return (singleton ??= createApplicationRepository());
}
export const applicationRepository: ApplicationRepository = {
  list: async (...args) => (await repository()).list(...args),
  listPage: async (...args) => (await repository()).listPage(...args),
  getById: async (...args) => (await repository()).getById(...args),
  getByEnquiryId: async (...args) =>
    (await repository()).getByEnquiryId(...args),
  findPotentialDuplicates: async (...args) =>
    (await repository()).findPotentialDuplicates(...args),
  nextApplicationSequence: async (...args) =>
    (await repository()).nextApplicationSequence(...args),
  nextAdmissionSequence: async (...args) =>
    (await repository()).nextAdmissionSequence(...args),
  create: async (...args) => (await repository()).create(...args),
  replace: async (...args) => (await repository()).replace(...args),
};
