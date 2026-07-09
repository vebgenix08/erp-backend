"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.academicYearRepository = exports.InMemoryAcademicYearRepository = void 0;
function clone(record) {
    return {
        ...record,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
        activatedAt: record.activatedAt ? new Date(record.activatedAt) : undefined,
        deactivatedAt: record.deactivatedAt ? new Date(record.deactivatedAt) : undefined,
    };
}
function now() {
    return new Date();
}
class InMemoryAcademicYearRepository {
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
        return [...this.getBucket(tenantId).records.values()]
            .filter((record) => !filter?.status || record.status === filter.status)
            .sort((left, right) => left.startDate.localeCompare(right.startDate) || left.code.localeCompare(right.code))
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
            id: `academic_year_${tenantId}_${this.getBucket(tenantId).records.size + 1}`,
            tenantId,
            code: input.code,
            name: input.name,
            startDate: input.startDate,
            endDate: input.endDate,
            status: "INACTIVE",
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
        };
        bucket.records.set(id, updated);
        return clone(updated);
    }
    async activate(tenantId, id) {
        const bucket = this.getBucket(tenantId);
        const existing = bucket.records.get(id);
        if (!existing)
            return null;
        const nowValue = now();
        for (const [recordId, record] of bucket.records.entries()) {
            bucket.records.set(recordId, {
                ...record,
                status: recordId === id ? "ACTIVE" : "INACTIVE",
                activatedAt: recordId === id ? nowValue : record.activatedAt,
                deactivatedAt: recordId === id ? record.deactivatedAt : record.deactivatedAt ?? nowValue,
                updatedAt: nowValue,
            });
        }
        return clone(bucket.records.get(id));
    }
}
exports.InMemoryAcademicYearRepository = InMemoryAcademicYearRepository;
exports.academicYearRepository = new InMemoryAcademicYearRepository();
