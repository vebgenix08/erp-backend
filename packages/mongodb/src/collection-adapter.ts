import type { Collection, Document, Filter, OptionalUnlessRequiredId } from "mongodb";
import { BadRequestError } from "@school-erp/errors";
import type {
  CollectionAdapter,
  PlatformCollectionAdapter,
  TenantFilter,
  TenantOwnedDocument,
} from "./types";

function adapter<TDocument extends Document>(
  collection: Collection<TDocument>,
): PlatformCollectionAdapter<TDocument> {
  return {
    name: collection.collectionName,
    async findOne(filter: Filter<TDocument>) {
      return (await collection.findOne(filter)) as TDocument | null;
    },
    async findMany(filter: Filter<TDocument> = {}, options = {}) {
      let cursor = collection.find(filter);
      if (options.sort) cursor = cursor.sort(options.sort);
      if (options.skip) cursor = cursor.skip(options.skip);
      if (options.limit !== undefined) cursor = cursor.limit(options.limit);
      return (await cursor.toArray()) as TDocument[];
    },
    async count(filter: Filter<TDocument> = {}) {
      return await collection.countDocuments(filter);
    },
    async insertOne(document: TDocument) {
      await collection.insertOne(document as OptionalUnlessRequiredId<TDocument>);
      return document;
    },
    async replaceOne(filter: Filter<TDocument>, document: TDocument) {
      const result = await collection.replaceOne(filter, document, {
        upsert: false,
      });
      return result.matchedCount > 0 ? document : null;
    },
    async findOneAndUpdate(filter: Filter<TDocument>, update: Document, options = {}) {
      return (await collection.findOneAndUpdate(filter, update, {
        upsert: options.upsert ?? false,
        returnDocument: options.returnDocument ?? "after",
        includeResultMetadata: false,
      })) as TDocument | null;
    },
    async deleteOne(filter: Filter<TDocument>) {
      const result = await collection.deleteOne(filter);
      return result.deletedCount > 0;
    },
  };
}

function requiredTenantId(value: unknown, operation: string): string {
  const tenantId = typeof value === "string" ? value.trim() : "";
  if (!tenantId) throw new BadRequestError(`tenantId is required for ${operation}`);
  return tenantId;
}

function tenantFilter<TDocument extends TenantOwnedDocument>(
  filter: TenantFilter<TDocument>,
  operation: string,
) {
  requiredTenantId((filter as Record<string, unknown>).tenantId, operation);
  return filter;
}

function tenantDocument<TDocument extends TenantOwnedDocument>(
  document: TDocument,
  operation: string,
) {
  requiredTenantId(document.tenantId, operation);
  return document;
}

function assertTenantUnchanged<TDocument extends TenantOwnedDocument>(
  filter: TenantFilter<TDocument>,
  update: Document,
) {
  const expected = requiredTenantId(
    (filter as Record<string, unknown>).tenantId,
    "findOneAndUpdate",
  );
  const setTenant = (update.$set as Record<string, unknown> | undefined)?.tenantId;
  const insertTenant = (update.$setOnInsert as Record<string, unknown> | undefined)?.tenantId;
  if (setTenant !== undefined && setTenant !== expected)
    throw new BadRequestError("tenantId cannot be changed by an update");
  if (insertTenant !== undefined && insertTenant !== expected)
    throw new BadRequestError("tenantId cannot be changed by an upsert");
}

export function createTenantCollectionAdapter<TDocument extends TenantOwnedDocument>(
  collectionAdapter: PlatformCollectionAdapter<TDocument>,
): CollectionAdapter<TDocument> {
  return {
    name: collectionAdapter.name,
    findOne: (filter) => collectionAdapter.findOne(tenantFilter(filter, "findOne")),
    findMany: (filter, options) =>
      collectionAdapter.findMany(tenantFilter(filter, "findMany"), options),
    count: (filter) => collectionAdapter.count(tenantFilter(filter, "count")),
    insertOne: (document) => collectionAdapter.insertOne(tenantDocument(document, "insertOne")),
    replaceOne(filter, document) {
      const scopedFilter = tenantFilter(filter, "replaceOne");
      const expected = requiredTenantId(
        (scopedFilter as Record<string, unknown>).tenantId,
        "replaceOne",
      );
      if (tenantDocument(document, "replaceOne").tenantId !== expected) {
        throw new BadRequestError("replacement tenantId must match the query tenantId");
      }
      return collectionAdapter.replaceOne(scopedFilter, document);
    },
    findOneAndUpdate(filter, update, options) {
      const scopedFilter = tenantFilter(filter, "findOneAndUpdate");
      assertTenantUnchanged(scopedFilter, update);
      const tenantId = requiredTenantId(
        (scopedFilter as Record<string, unknown>).tenantId,
        "findOneAndUpdate",
      );
      const safeUpdate = options?.upsert
        ? {
            ...update,
            $setOnInsert: {
              ...((update.$setOnInsert as Record<string, unknown> | undefined) ?? {}),
              tenantId,
            },
          }
        : update;
      return collectionAdapter.findOneAndUpdate(scopedFilter, safeUpdate, options);
    },
    deleteOne: (filter) => collectionAdapter.deleteOne(tenantFilter(filter, "deleteOne")),
  };
}

export function createMongoCollectionAdapter<TDocument extends TenantOwnedDocument>(
  collection: Collection<TDocument>,
): CollectionAdapter<TDocument> {
  return createTenantCollectionAdapter(adapter(collection));
}

export function createPlatformMongoCollectionAdapter<TDocument extends Document>(
  collection: Collection<TDocument>,
): PlatformCollectionAdapter<TDocument> {
  return adapter(collection);
}
