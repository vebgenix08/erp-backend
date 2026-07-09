"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.campusRepository = exports.InMemoryCampusRepository = void 0;
function clone(record) {
    return {
        ...record,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
        deactivatedAt: record.deactivatedAt ? new Date(record.deactivatedAt) : undefined,
    };
}
function now() {
    return new Date();
}
class InMemoryCampusRepository {
    buckets = new Map();
    getBucket(tenantId) {
        let bucket = this.buckets.get(tenantId);
        if (!bucket) {
            bucket = { records: new Map() };
            this.buckets.set(tenantId, bucket);
        }
        return bucket;
    }
    async list(tenantId, filter) {
        const records = [...this.getBucket(tenantId).records.values()];
        return records
            .filter((record) => !filter?.status || record.status === filter.status)
            .sort((left, right) => left.name.localeCompare(right.name))
            .map(clone);
    }
    async getById(tenantId, id) {
        const record = this.getBucket(tenantId).records.get(id);
        return record ? clone(record) : null;
    }
    async getByCode(tenantId, code) {
        const record = [...this.getBucket(tenantId).records.values()].find((item) => item.code.toLowerCase() === code.toLowerCase());
        return record ? clone(record) : null;
    }
    async create(tenantId, input) {
        const timestamp = now();
        const record = {
            id: `campus_${tenantId}_${this.getBucket(tenantId).records.size + 1}`,
            tenantId,
            code: input.code,
            name: input.name,
            campusType: input.campusType,
            status: "ACTIVE",
            address: input.address,
            createdAt: timestamp,
            updatedAt: timestamp,
        };
        this.getBucket(tenantId).records.set(record.id, record);
        return clone(record);
    }
    async update(tenantId, id, input) {
        const bucket = this.getBucket(tenantId);
        const existing = bucket.records.get(id);
        if (!existing)
            return null;
        const updated = {
            ...existing,
            ...input,
            updatedAt: now(),
            deactivatedAt: input.status === "INACTIVE" ? existing.deactivatedAt ?? now() : existing.deactivatedAt,
        };
        bucket.records.set(id, updated);
        return clone(updated);
    }
    async deactivate(tenantId, id) {
        return this.update(tenantId, id, { status: "INACTIVE" });
    }
}
exports.InMemoryCampusRepository = InMemoryCampusRepository;
exports.campusRepository = new InMemoryCampusRepository();
