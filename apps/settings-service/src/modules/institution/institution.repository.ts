import type { RepositoryContext } from "@school-erp/mongodb";
import type {
  InstitutionProfileInput,
  InstitutionProfileRecord,
  InstitutionProfileUpdateInput,
} from "./institution.model";

export interface InstitutionRepository {
  list(tenantId: string, context?: RepositoryContext): Promise<InstitutionProfileRecord[]>;
  getById(tenantId: string, id: string, context?: RepositoryContext): Promise<InstitutionProfileRecord | null>;
  create(tenantId: string, input: InstitutionProfileInput, context?: RepositoryContext): Promise<InstitutionProfileRecord>;
  update(tenantId: string, id: string, input: InstitutionProfileUpdateInput, context?: RepositoryContext): Promise<InstitutionProfileRecord | null>;
}

function now() {
  return new Date();
}

function clone(record: InstitutionProfileRecord): InstitutionProfileRecord {
  return { ...record, createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt) };
}

export class InMemoryInstitutionRepository implements InstitutionRepository {
  private readonly records = new Map<string, InstitutionProfileRecord>();

  async list(tenantId: string, _context?: RepositoryContext) {
    const record = this.records.get(tenantId);
    return record ? [clone(record)] : [];
  }

  async getById(tenantId: string, _id: string, _context?: RepositoryContext) {
    const record = this.records.get(tenantId);
    return record ? clone(record) : null;
  }

  async create(tenantId: string, input: InstitutionProfileInput, _context?: RepositoryContext) {
    const timestamp = now();
    const record: InstitutionProfileRecord = {
      id: `institution_${tenantId}`,
      tenantId,
      name: input.name,
      shortName: input.shortName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      address: input.address,
      logoUrl: input.logoUrl,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.records.set(tenantId, record);
    return clone(record);
  }

  async update(tenantId: string, _id: string, input: InstitutionProfileUpdateInput, _context?: RepositoryContext) {
    const existing = this.records.get(tenantId);
    if (!existing) return null;
    const updated: InstitutionProfileRecord = {
      ...existing,
      ...input,
      updatedAt: now(),
    };
    this.records.set(tenantId, updated);
    return clone(updated);
  }
}

export const institutionRepository: InstitutionRepository = new InMemoryInstitutionRepository();
