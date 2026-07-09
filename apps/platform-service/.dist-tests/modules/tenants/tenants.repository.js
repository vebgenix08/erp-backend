"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantRepository = exports.InMemoryTenantRepository = void 0;
function now() {
    return new Date();
}
function toTenantRecord(input, id = "tenant-1") {
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
class InMemoryTenantRepository {
    tenants = new Map();
    async list() {
        return [...this.tenants.values()].sort((left, right) => left.name.localeCompare(right.name));
    }
    async getById(id) {
        return this.tenants.get(id) ?? null;
    }
    async getByCode(code) {
        return [...this.tenants.values()].find((tenant) => tenant.code.toLowerCase() === code.toLowerCase()) ?? null;
    }
    async create(input) {
        const id = `tenant_${this.tenants.size + 1}`;
        const tenant = toTenantRecord(input, id);
        this.tenants.set(id, tenant);
        return tenant;
    }
    async update(id, input) {
        const existing = this.tenants.get(id);
        if (!existing)
            return null;
        const updated = {
            ...existing,
            ...input,
            status: input.status ?? existing.status,
            updatedAt: now(),
            deactivatedAt: input.status === "INACTIVE" || input.status === "SUSPENDED"
                ? existing.deactivatedAt ?? now()
                : input.status === "ACTIVE"
                    ? undefined
                    : existing.deactivatedAt,
        };
        this.tenants.set(id, updated);
        return updated;
    }
}
exports.InMemoryTenantRepository = InMemoryTenantRepository;
exports.tenantRepository = new InMemoryTenantRepository();
