import { BadRequestError, ConflictError } from "@school-erp/errors";
import type { CollectionAdapter, MongoEnvLike } from "@school-erp/mongodb";
import { createMongoCollectionAdapter, getCollection } from "@school-erp/mongodb";
import type { TemplateCreateInput, TemplateListFilter, TemplateRecord, TemplateUpdateInput } from "./templates.model";

export interface TemplateRepository {
  list(tenantId: string, filter?: TemplateListFilter): Promise<TemplateRecord[]>;
  getById(tenantId: string, id: string): Promise<TemplateRecord | null>;
  getByCode(tenantId: string, code: string): Promise<TemplateRecord | null>;
  create(tenantId: string, input: TemplateCreateInput): Promise<TemplateRecord>;
  update(tenantId: string, id: string, input: TemplateUpdateInput): Promise<TemplateRecord | null>;
  publish(tenantId: string, id: string): Promise<TemplateRecord | null>;
  archive(tenantId: string, id: string): Promise<TemplateRecord | null>;
  delete(tenantId: string, id: string): Promise<boolean>;
}

interface TemplateDocument extends TemplateRecord {
  _id: string;
}

function now() {
  return new Date();
}

function clone(record: TemplateRecord): TemplateRecord {
  return {
    ...record,
    sections: (record.sections ?? []).map((section) => ({ ...section })),
    fields: record.fields.map((field) => ({ ...field, options: field.options ? [...field.options] : undefined, rules: field.rules ? { ...field.rules } : undefined })),
    requiredSystemKeys: [...record.requiredSystemKeys],
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    publishedAt: record.publishedAt ? new Date(record.publishedAt) : undefined,
    archivedAt: record.archivedAt ? new Date(record.archivedAt) : undefined,
  };
}

function toDocument(record: TemplateRecord): TemplateDocument {
  return { ...clone(record), _id: record.id };
}

function fromDocument(document: TemplateDocument | null): TemplateRecord | null {
  if (!document) return null;
  const { _id, ...record } = document;
  return clone({ ...record, id: record.id || _id });
}

function makeId(): string {
  return `template_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function createRecord(tenantId: string, input: TemplateCreateInput): TemplateRecord {
  const timestamp = now();
  return {
    id: makeId(),
    tenantId,
    code: normalize(input.code),
    name: input.name.trim(),
    templateType: input.templateType,
    status: "DRAFT",
    version: 1,
    description: input.description?.trim() || undefined,
    subject: input.subject?.trim() || undefined,
    body: input.body?.trim() || undefined,
    layout: input.layout?.trim() || undefined,
    sections: input.sections ? input.sections.map((section) => ({ ...section })) : [],
    fields: input.fields ? input.fields.map((field) => ({ ...field })) : [],
    requiredSystemKeys: input.requiredSystemKeys ? [...new Set(input.requiredSystemKeys.map((key) => key.trim()).filter(Boolean))] : [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function matchesSearch(record: TemplateRecord, search: string): boolean {
  const query = search.toLowerCase();
  return (
    record.code.toLowerCase().includes(query) ||
    record.name.toLowerCase().includes(query) ||
    (record.description?.toLowerCase().includes(query) ?? false) ||
    record.templateType.toLowerCase().includes(query)
  );
}

function normalizeTenantId(tenantId: string): string {
  const normalized = tenantId.trim();
  if (!normalized) {
    throw new BadRequestError("tenantId is required");
  }
  return normalized;
}

function validateUniqueCode(existing: TemplateRecord | null, id: string, code: string): void {
  if (existing && existing.id !== id) {
    throw new ConflictError("template code must be unique");
  }
}

export class InMemoryTemplateRepository implements TemplateRepository {
  private readonly records = new Map<string, Map<string, TemplateRecord>>();

  private bucket(tenantId: string): Map<string, TemplateRecord> {
    let bucket = this.records.get(tenantId);
    if (!bucket) {
      bucket = new Map<string, TemplateRecord>();
      this.records.set(tenantId, bucket);
    }
    return bucket;
  }

  async list(tenantId: string, filter: TemplateListFilter = {}) {
    return [...this.bucket(normalizeTenantId(tenantId)).values()]
      .filter((record) => {
        if (filter.status && record.status !== filter.status) return false;
        if (filter.templateType && record.templateType !== filter.templateType) return false;
        if (filter.search && !matchesSearch(record, filter.search)) return false;
        return true;
      })
      .sort((left, right) => left.code.localeCompare(right.code))
      .map(clone);
  }

  async getById(tenantId: string, id: string) {
    const record = this.bucket(normalizeTenantId(tenantId)).get(id) ?? null;
    return record ? clone(record) : null;
  }

  async getByCode(tenantId: string, code: string) {
    const normalized = normalize(code);
    const record = [...this.bucket(normalizeTenantId(tenantId)).values()].find((item) => item.code === normalized) ?? null;
    return record ? clone(record) : null;
  }

  async create(tenantId: string, input: TemplateCreateInput) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const duplicate = await this.getByCode(normalizedTenantId, input.code);
    validateUniqueCode(duplicate, "", input.code);
    const record = createRecord(normalizedTenantId, input);
    this.bucket(normalizedTenantId).set(record.id, record);
    return clone(record);
  }

  async update(tenantId: string, id: string, input: TemplateUpdateInput) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const bucket = this.bucket(normalizedTenantId);
    const existing = bucket.get(id);
    if (!existing || existing.status === "ARCHIVED") return null;
    if (input.code !== undefined) {
      const duplicate = await this.getByCode(normalizedTenantId, input.code);
      validateUniqueCode(duplicate, id, input.code);
    }
    const nextVersion = existing.version + 1;
    const updated: TemplateRecord = clone({
      ...existing,
      code: input.code ? normalize(input.code) : existing.code,
      name: input.name ? input.name.trim() : existing.name,
      templateType: input.templateType ?? existing.templateType,
      description: input.description !== undefined ? input.description?.trim() || undefined : existing.description,
      subject: input.subject !== undefined ? input.subject?.trim() || undefined : existing.subject,
      body: input.body !== undefined ? input.body?.trim() || undefined : existing.body,
      layout: input.layout !== undefined ? input.layout?.trim() || undefined : existing.layout,
      sections: input.sections ? input.sections.map((section) => ({ ...section })) : existing.sections,
      fields: input.fields ? input.fields.map((field) => ({ ...field })) : existing.fields,
      requiredSystemKeys: input.requiredSystemKeys ? [...new Set(input.requiredSystemKeys.map((key) => key.trim()).filter(Boolean))] : existing.requiredSystemKeys,
      status: "DRAFT",
      version: nextVersion,
      updatedAt: now(),
      archivedAt: undefined,
    });
    bucket.set(id, updated);
    return clone(updated);
  }

  async publish(tenantId: string, id: string) {
    const bucket = this.bucket(normalizeTenantId(tenantId));
    const existing = bucket.get(id);
    if (!existing || existing.status === "ARCHIVED") return null;
    const nowValue = now();
    const published: TemplateRecord = clone({
      ...existing,
      status: "PUBLISHED",
      publishedVersion: existing.version,
      publishedAt: nowValue,
      archivedAt: undefined,
      updatedAt: nowValue,
    });
    bucket.set(id, published);
    return clone(published);
  }

  async archive(tenantId: string, id: string) {
    const bucket = this.bucket(normalizeTenantId(tenantId));
    const existing = bucket.get(id);
    if (!existing) return null;
    const nowValue = now();
    const archived: TemplateRecord = clone({
      ...existing,
      status: "ARCHIVED",
      archivedAt: nowValue,
      updatedAt: nowValue,
    });
    bucket.set(id, archived);
    return clone(archived);
  }

  async delete(tenantId: string, id: string) {
    return this.bucket(normalizeTenantId(tenantId)).delete(id);
  }
}

export class MongoTemplateRepository implements TemplateRepository {
  constructor(private readonly collection: CollectionAdapter<TemplateDocument>) {}

  async list(tenantId: string, filter: TemplateListFilter = {}) {
    const records = await this.collection.findMany({ tenantId: normalizeTenantId(tenantId) });
    return records
      .map((record) => fromDocument(record))
      .filter((record): record is TemplateRecord => record !== null)
      .filter((record) => {
        if (filter.status && record.status !== filter.status) return false;
        if (filter.templateType && record.templateType !== filter.templateType) return false;
        if (filter.search && !matchesSearch(record, filter.search)) return false;
        return true;
      })
      .sort((left, right) => left.code.localeCompare(right.code));
  }

  async getById(tenantId: string, id: string) {
    return fromDocument(await this.collection.findOne({ tenantId: normalizeTenantId(tenantId), _id: id }));
  }

  async getByCode(tenantId: string, code: string) {
    return fromDocument(await this.collection.findOne({ tenantId: normalizeTenantId(tenantId), code: normalize(code) }));
  }

  async create(tenantId: string, input: TemplateCreateInput) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const duplicate = await this.getByCode(normalizedTenantId, input.code);
    validateUniqueCode(duplicate, "", input.code);
    const record = createRecord(normalizedTenantId, input);
    await this.collection.insertOne(toDocument(record));
    return record;
  }

  async update(tenantId: string, id: string, input: TemplateUpdateInput) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const existing = await this.getById(normalizedTenantId, id);
    if (!existing || existing.status === "ARCHIVED") return null;
    if (input.code !== undefined) {
      const duplicate = await this.getByCode(normalizedTenantId, input.code);
      validateUniqueCode(duplicate, id, input.code);
    }
    const nextVersion = existing.version + 1;
    const updated: TemplateRecord = clone({
      ...existing,
      code: input.code ? normalize(input.code) : existing.code,
      name: input.name ? input.name.trim() : existing.name,
      templateType: input.templateType ?? existing.templateType,
      description: input.description !== undefined ? input.description?.trim() || undefined : existing.description,
      subject: input.subject !== undefined ? input.subject?.trim() || undefined : existing.subject,
      body: input.body !== undefined ? input.body?.trim() || undefined : existing.body,
      layout: input.layout !== undefined ? input.layout?.trim() || undefined : existing.layout,
      sections: input.sections ? input.sections.map((section) => ({ ...section })) : existing.sections,
      fields: input.fields ? input.fields.map((field) => ({ ...field })) : existing.fields,
      requiredSystemKeys: input.requiredSystemKeys ? [...new Set(input.requiredSystemKeys.map((key) => key.trim()).filter(Boolean))] : existing.requiredSystemKeys,
      status: "DRAFT",
      version: nextVersion,
      updatedAt: now(),
      archivedAt: undefined,
    });
    const replaced = await this.collection.replaceOne({ tenantId: normalizedTenantId, _id: id }, toDocument(updated));
    return replaced ? updated : null;
  }

  async publish(tenantId: string, id: string) {
    const existing = await this.getById(tenantId, id);
    if (!existing || existing.status === "ARCHIVED") return null;
    const nowValue = now();
    const published: TemplateRecord = clone({
      ...existing,
      status: "PUBLISHED",
      publishedVersion: existing.version,
      publishedAt: nowValue,
      archivedAt: undefined,
      updatedAt: nowValue,
    });
    const replaced = await this.collection.replaceOne({ tenantId: normalizeTenantId(tenantId), _id: id }, toDocument(published));
    return replaced ? published : null;
  }

  async archive(tenantId: string, id: string) {
    const existing = await this.getById(tenantId, id);
    if (!existing) return null;
    const nowValue = now();
    const archived: TemplateRecord = clone({
      ...existing,
      status: "ARCHIVED",
      archivedAt: nowValue,
      updatedAt: nowValue,
    });
    const replaced = await this.collection.replaceOne({ tenantId: normalizeTenantId(tenantId), _id: id }, toDocument(archived));
    return replaced ? archived : null;
  }

  async delete(tenantId: string, id: string) {
    return this.collection.deleteOne({ tenantId: normalizeTenantId(tenantId), _id: id });
  }
}

function hasMongoEnv(env: MongoEnvLike): boolean {
  return Boolean(env.MONGODB_URI || env.MONGODB_URI_DEV || env.MONGODB_URI_PROD || env.MONGODB_URI_TEST);
}

function getRuntimeEnv(): MongoEnvLike {
  const runtime = globalThis as unknown as { process?: { env?: MongoEnvLike } };
  return runtime.process?.env ?? {};
}

export async function createTemplateRepository(env: MongoEnvLike = getRuntimeEnv()): Promise<TemplateRepository> {
  if (!hasMongoEnv(env)) {
    return new InMemoryTemplateRepository();
  }
  const collection = await getCollection<TemplateDocument>("settings_templates", env);
  await collection.createIndex({ tenantId: 1, code: 1 }, { unique: true });
  await collection.createIndex({ tenantId: 1, status: 1 });
  await collection.createIndex({ tenantId: 1, templateType: 1 });
  return new MongoTemplateRepository(createMongoCollectionAdapter(collection));
}

let defaultRepository: Promise<TemplateRepository> | undefined;

function getDefaultRepository(): Promise<TemplateRepository> {
  defaultRepository ??= createTemplateRepository();
  return defaultRepository;
}

export const templateRepository: TemplateRepository = {
  list: async (...args) => (await getDefaultRepository()).list(...args),
  getById: async (...args) => (await getDefaultRepository()).getById(...args),
  getByCode: async (...args) => (await getDefaultRepository()).getByCode(...args),
  create: async (...args) => (await getDefaultRepository()).create(...args),
  update: async (...args) => (await getDefaultRepository()).update(...args),
  publish: async (...args) => (await getDefaultRepository()).publish(...args),
  archive: async (...args) => (await getDefaultRepository()).archive(...args),
  delete: async (...args) => (await getDefaultRepository()).delete(...args),
};
