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

  async findMany(filter: Filter<TDocument> = {}) {
    return [...this.records.values()].filter((record) => matchesFilter(record, filter)).map((record) => structuredClone(record));
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
