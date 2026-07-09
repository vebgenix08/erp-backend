import type { PlatformRepository, RepositoryContext } from "@school-erp/mongodb";
import type { TenantCreateInput, TenantRecord, TenantUpdateInput } from "./tenants.model";

export interface TenantRepository
  extends PlatformRepository<TenantRecord, TenantCreateInput, TenantUpdateInput> {
  getByCode(code: string, context?: RepositoryContext): Promise<TenantRecord | null>;
}

function now() {
  return new Date();
}

function toTenantRecord(input: TenantCreateInput, id = "tenant-1"): TenantRecord {
  const timestamp = now();
  return {
    id,
    name: input.name,
    code: input.code,
    type: input.type,
    status: "ACTIVE",
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    address: input.address,
    academicYearStartMonth: input.academicYearStartMonth,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export class InMemoryTenantRepository implements TenantRepository {
  private readonly tenants = new Map<string, TenantRecord>();

  async list() {
    return [...this.tenants.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  async getById(id: string) {
    return this.tenants.get(id) ?? null;
  }

  async getByCode(code: string) {
    return [...this.tenants.values()].find((tenant) => tenant.code.toLowerCase() === code.toLowerCase()) ?? null;
  }

  async create(input: TenantCreateInput) {
    const id = `tenant_${this.tenants.size + 1}`;
    const tenant = toTenantRecord(input, id);
    this.tenants.set(id, tenant);
    return tenant;
  }

  async update(id: string, input: TenantUpdateInput) {
    const existing = this.tenants.get(id);
    if (!existing) return null;
    const updated: TenantRecord = {
      ...existing,
      ...input,
      status: input.status ?? existing.status,
      updatedAt: now(),
      deactivatedAt:
        input.status === "INACTIVE" || input.status === "SUSPENDED"
          ? existing.deactivatedAt ?? now()
          : input.status === "ACTIVE"
            ? undefined
            : existing.deactivatedAt,
    };
    this.tenants.set(id, updated);
    return updated;
  }
}

export const tenantRepository: TenantRepository = new InMemoryTenantRepository();
