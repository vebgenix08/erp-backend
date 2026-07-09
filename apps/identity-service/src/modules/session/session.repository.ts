import type { SessionRepository, SessionTenantSnapshot } from "./session.model";

function clone(record: SessionTenantSnapshot): SessionTenantSnapshot {
  return { ...record };
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly selectedTenants = new Map<string, SessionTenantSnapshot>();

  async getSelectedTenant(userId: string) {
    const record = this.selectedTenants.get(userId);
    return record ? clone(record) : null;
  }

  async saveSelectedTenant(userId: string, tenant: SessionTenantSnapshot) {
    this.selectedTenants.set(userId, clone(tenant));
    return clone(tenant);
  }
}

export const sessionRepository = new InMemorySessionRepository();
