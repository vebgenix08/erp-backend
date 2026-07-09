export interface InMemoryRepositoryStore<TEntity extends { id: string }> {
  seed(entity: TEntity): void;
  clear(): void;
  list(): TEntity[];
  getById(id: string): TEntity | null;
}

export function createInMemoryRepositoryStore<TEntity extends { id: string }>(): InMemoryRepositoryStore<TEntity> {
  const records = new Map<string, TEntity>();

  return {
    seed(entity: TEntity) {
      records.set(entity.id, entity);
    },
    clear() {
      records.clear();
    },
    list() {
      return [...records.values()];
    },
    getById(id: string) {
      return records.get(id) ?? null;
    },
  };
}
