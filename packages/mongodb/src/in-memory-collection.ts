import type { Document, Filter } from "mongodb";
import type { CollectionAdapter } from "./types";

function matchesFilter<TDocument extends Document>(document: TDocument, filter: Filter<TDocument> = {}): boolean {
  const entries = Object.entries(filter as Record<string, unknown>);
  return entries.every(([key, expected]) => {
    const actual = (document as Record<string, unknown>)[key];
    if (expected && typeof expected === "object" && "$in" in expected && Array.isArray((expected as { $in?: unknown[] }).$in)) {
      return (expected as { $in: unknown[] }).$in.some((candidate) => candidate === actual);
    }
    return actual === expected;
  });
}

export class InMemoryCollection<TDocument extends Document> implements CollectionAdapter<TDocument> {
  readonly name: string;
  private readonly records = new Map<string, TDocument>();

  constructor(name: string, initial: TDocument[] = []) {
    this.name = name;
    for (const record of initial) {
      this.seed(record);
    }
  }

  seed(document: TDocument) {
    this.records.set(String((document as Record<string, unknown>)._id), structuredClone(document));
  }

  async findOne(filter: Filter<TDocument> = {}) {
    for (const record of this.records.values()) {
      if (matchesFilter(record, filter)) {
        return structuredClone(record);
      }
    }
    return null;
  }

  async findMany(filter: Filter<TDocument> = {}, options: { sort?: Record<string, 1 | -1>; skip?: number; limit?: number } = {}) {
    let records = [...this.records.values()].filter((record) => matchesFilter(record, filter));
    if (options.sort) {
      const sortEntries = Object.entries(options.sort);
      records.sort((left, right) => {
        for (const [field, direction] of sortEntries) {
          const a = (left as Record<string, unknown>)[field];
          const b = (right as Record<string, unknown>)[field];
          const comparison = String(a ?? "").localeCompare(String(b ?? ""));
          if (comparison) return comparison * direction;
        }
        return 0;
      });
    }
    const start = Math.max(0, options.skip ?? 0);
    const end = options.limit === undefined ? undefined : start + Math.max(0, options.limit);
    return records.slice(start, end).map((record) => structuredClone(record));
  }

  async count(filter: Filter<TDocument> = {}) {
    return [...this.records.values()].filter((record) => matchesFilter(record, filter)).length;
  }

  async insertOne(document: TDocument) {
    this.seed(document);
    return structuredClone(document);
  }

  async replaceOne(filter: Filter<TDocument>, document: TDocument) {
    for (const [key, record] of this.records.entries()) {
      if (matchesFilter(record, filter)) {
        this.records.set(key, structuredClone(document));
        return structuredClone(document);
      }
    }
    return null;
  }

  async findOneAndUpdate(filter: Filter<TDocument>, update: Document, options: { upsert?: boolean; returnDocument?: "before" | "after" } = {}) {
    const existing = await this.findOne(filter);
    if (!existing && !options.upsert) return null;
    const before = existing ? structuredClone(existing) : null;
    const base = existing ?? ({ ...(filter as Record<string, unknown>), ...((update.$setOnInsert as Record<string, unknown> | undefined) ?? {}) } as TDocument);
    const next = { ...base, ...((update.$set as Record<string, unknown> | undefined) ?? {}) } as Record<string, unknown>;
    for (const [key, amount] of Object.entries((update.$inc as Record<string, number> | undefined) ?? {})) next[key] = Number(next[key] ?? 0) + amount;
    this.seed(next as TDocument);
    return structuredClone((options.returnDocument ?? "after") === "before" ? before : next as TDocument);
  }

  async deleteOne(filter: Filter<TDocument>) {
    for (const [key, record] of this.records.entries()) {
      if (matchesFilter(record, filter)) {
        this.records.delete(key);
        return true;
      }
    }
    return false;
  }
}

export function createInMemoryCollection<TDocument extends Document>(name: string, initial: TDocument[] = []) {
  return new InMemoryCollection<TDocument>(name, initial);
}
