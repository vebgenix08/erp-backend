"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionRepository = exports.InMemorySessionRepository = void 0;
function clone(record) {
    return { ...record };
}
class InMemorySessionRepository {
    selectedTenants = new Map();
    async getSelectedTenant(userId) {
        const record = this.selectedTenants.get(userId);
        return record ? clone(record) : null;
    }
    async saveSelectedTenant(userId, tenant) {
        this.selectedTenants.set(userId, clone(tenant));
        return clone(tenant);
    }
}
exports.InMemorySessionRepository = InMemorySessionRepository;
exports.sessionRepository = new InMemorySessionRepository();
