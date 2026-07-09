"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantScopedBaseRepository = exports.PlatformBaseRepository = exports.BaseRepository = void 0;
exports.createTenantScopeFilter = createTenantScopeFilter;
const errors_1 = require("@school-erp/errors");
class BaseRepository {
    collection;
    constructor(collection) {
        this.collection = collection;
    }
    async findOne(filter) {
        return this.collection.findOne(filter);
    }
    async findMany(filter = {}) {
        return this.collection.findMany(filter);
    }
    async insertOne(document, _context) {
        return this.collection.insertOne(document);
    }
    async replaceOne(filter, document, _context) {
        return this.collection.replaceOne(filter, document);
    }
    async deleteOne(filter, _context) {
        return this.collection.deleteOne(filter);
    }
}
exports.BaseRepository = BaseRepository;
class PlatformBaseRepository extends BaseRepository {
    constructor(collection) {
        super(collection);
    }
}
exports.PlatformBaseRepository = PlatformBaseRepository;
class TenantScopedBaseRepository extends BaseRepository {
    constructor(collection) {
        super(collection);
    }
    requireTenantId(tenantId) {
        const normalized = typeof tenantId === "string" ? tenantId.trim() : "";
        if (!normalized) {
            throw new errors_1.BadRequestError("tenantId is required");
        }
        return normalized;
    }
    tenantFilter(tenantId, filter = {}) {
        return { ...filter, tenantId };
    }
    assertTenantOwnership(document, tenantId) {
        if (document.tenantId !== tenantId) {
            throw new errors_1.NotFoundError("Tenant-scoped record not found");
        }
    }
}
exports.TenantScopedBaseRepository = TenantScopedBaseRepository;
function createTenantScopeFilter(tenantId, filter = {}) {
    const normalized = typeof tenantId === "string" ? tenantId.trim() : "";
    if (!normalized) {
        throw new errors_1.BadRequestError("tenantId is required");
    }
    return { ...filter, tenantId: normalized };
}
