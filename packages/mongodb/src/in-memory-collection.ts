import type { Document, Filter } from "mongodb";
import type { PlatformCollectionAdapter } from "./types";

function valueAtPath(document: Document, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (!value || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[key];
  }, document);
}

function sameValue(actual: unknown, expected: unknown) {
  if (actual instanceof Date && expected instanceof Date)
    return actual.getTime() === expected.getTime();
  return actual === expected;
}

function compareValues(actual: unknown, expected: unknown): number {
  const left = actual instanceof Date ? actual.getTime() : actual;
  const right = expected instanceof Date ? expected.getTime() : expected;
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left ?? "").localeCompare(String(right ?? ""));
}

function matchesCondition(actual: unknown, expected: unknown): boolean {
  if (expected instanceof RegExp) return typeof actual === "string" && expected.test(actual);
  if (!expected || typeof expected !== "object" || Array.isArray(expected))
    return sameValue(actual, expected);
  const condition = expected as Record<string, unknown>;
  if (Array.isArray(condition.$in)) {
    const values = Array.isArray(actual) ? actual : [actual];
    if (
      !values.some(
        (value) =>
          condition.$in instanceof Array &&
          condition.$in.some((candidate) => sameValue(value, candidate)),
      )
    )
      return false;
  }
  if (condition.$regex !== undefined) {
    if (typeof actual !== "string") return false;
    const expression =
      condition.$regex instanceof RegExp
        ? condition.$regex
        : new RegExp(String(condition.$regex), String(condition.$options ?? ""));
    if (!expression.test(actual)) return false;
  }
  if (condition.$eq !== undefined && !sameValue(actual, condition.$eq)) return false;
  if (condition.$ne !== undefined && sameValue(actual, condition.$ne)) return false;
  if (condition.$exists !== undefined && (actual !== undefined) !== Boolean(condition.$exists))
    return false;
  if (condition.$gt !== undefined && compareValues(actual, condition.$gt) <= 0) return false;
  if (condition.$gte !== undefined && compareValues(actual, condition.$gte) < 0) return false;
  if (condition.$lt !== undefined && compareValues(actual, condition.$lt) >= 0) return false;
  if (condition.$lte !== undefined && compareValues(actual, condition.$lte) > 0) return false;
  return true;
}

function matchesFilter<TDocument extends Document>(
  document: TDocument,
  filter: Filter<TDocument> = {},
): boolean {
  const query = filter as Record<string, unknown>;
  if (
    Array.isArray(query.$and) &&
    !query.$and.every((item) => matchesFilter(document, item as Filter<TDocument>))
  )
    return false;
  if (
    Array.isArray(query.$or) &&
    !query.$or.some((item) => matchesFilter(document, item as Filter<TDocument>))
  )
    return false;
  return Object.entries(query)
    .filter(([key]) => key !== "$and" && key !== "$or")
    .every(([key, expected]) => matchesCondition(valueAtPath(document, key), expected));
}

export class InMemoryCollection<TDocument extends Document>
  implements PlatformCollectionAdapter<TDocument>
{
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

  async findMany(
    filter: Filter<TDocument> = {},
    options: {
      sort?: Record<string, 1 | -1>;
      skip?: number;
      limit?: number;
    } = {},
  ) {
    const records = [...this.records.values()].filter((record) => matchesFilter(record, filter));
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

  async findOneAndUpdate(
    filter: Filter<TDocument>,
    update: Document,
    options: { upsert?: boolean; returnDocument?: "before" | "after" } = {},
  ) {
    const existing = await this.findOne(filter);
    if (!existing && !options.upsert) return null;
    const before = existing ? structuredClone(existing) : null;
    const base =
      existing ??
      ({
        ...(filter as Record<string, unknown>),
        ...((update.$setOnInsert as Record<string, unknown> | undefined) ?? {}),
      } as TDocument);
    const next = {
      ...base,
      ...((update.$set as Record<string, unknown> | undefined) ?? {}),
    } as Record<string, unknown>;
    for (const [key, amount] of Object.entries(
      (update.$inc as Record<string, number> | undefined) ?? {},
    ))
      next[key] = Number(next[key] ?? 0) + amount;
    this.seed(next as TDocument);
    return structuredClone(
      (options.returnDocument ?? "after") === "before" ? before : (next as TDocument),
    );
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

export function createInMemoryCollection<TDocument extends Document>(
  name: string,
  initial: TDocument[] = [],
) {
  return new InMemoryCollection<TDocument>(name, initial);
}
