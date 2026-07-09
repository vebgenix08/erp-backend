"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.institutionRepository = exports.InMemoryInstitutionRepository = void 0;
function now() {
    return new Date();
}
function clone(record) {
    return { ...record, createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt) };
}
class InMemoryInstitutionRepository {
    records = new Map();
    async list(tenantId, _context) {
        const record = this.records.get(tenantId);
        return record ? [clone(record)] : [];
    }
    async getById(tenantId, _id, _context) {
        const record = this.records.get(tenantId);
        return record ? clone(record) : null;
    }
    async create(tenantId, input, _context) {
        const timestamp = now();
        const record = {
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
    async update(tenantId, _id, input, _context) {
        const existing = this.records.get(tenantId);
        if (!existing)
            return null;
        const updated = {
            ...existing,
            ...input,
            updatedAt: now(),
        };
        this.records.set(tenantId, updated);
        return clone(updated);
    }
}
exports.InMemoryInstitutionRepository = InMemoryInstitutionRepository;
exports.institutionRepository = new InMemoryInstitutionRepository();
