import { BadRequestError } from "@school-erp/errors";
import type {
  AggregateOptions,
  AggregationCursor,
  BulkWriteOptions,
  BulkWriteResult,
  Collection,
  CountDocumentsOptions,
  DeleteOptions,
  DeleteResult,
  DistinctOptions,
  Document,
  FindCursor,
  FindOneAndUpdateOptions,
  FindOptions,
  InsertManyResult,
  InsertOneOptions,
  InsertOneResult,
  OptionalUnlessRequiredId,
  UpdateFilter,
  UpdateOptions,
  UpdateResult,
  WithId,
} from "mongodb";
import type { TenantFilter, TenantOwnedDocument } from "./types";

type TenantBulkOperation<TDocument extends TenantOwnedDocument> =
  | { insertOne: { document: OptionalUnlessRequiredId<TDocument> } }
  | {
      updateOne: {
        filter: TenantFilter<TDocument>;
        update: UpdateFilter<TDocument> | Document;
        upsert?: boolean;
      };
    }
  | {
      updateMany: {
        filter: TenantFilter<TDocument>;
        update: UpdateFilter<TDocument> | Document;
        upsert?: boolean;
      };
    }
  | {
      replaceOne: {
        filter: TenantFilter<TDocument>;
        replacement: TDocument;
        upsert?: boolean;
      };
    }
  | { deleteOne: { filter: TenantFilter<TDocument> } }
  | { deleteMany: { filter: TenantFilter<TDocument> } };

export type TenantMongoCollection<TDocument extends TenantOwnedDocument> = Omit<
  Collection<TDocument>,
  | "aggregate"
  | "bulkWrite"
  | "countDocuments"
  | "deleteMany"
  | "deleteOne"
  | "distinct"
  | "find"
  | "findOne"
  | "findOneAndUpdate"
  | "insertMany"
  | "insertOne"
  | "replaceOne"
  | "updateMany"
  | "updateOne"
> & {
  aggregate<TResult extends Document = Document>(
    pipeline: Document[],
    options?: AggregateOptions,
  ): AggregationCursor<TResult>;
  bulkWrite(
    operations: TenantBulkOperation<TDocument>[],
    options?: BulkWriteOptions,
  ): Promise<BulkWriteResult>;
  countDocuments(filter: TenantFilter<TDocument>, options?: CountDocumentsOptions): Promise<number>;
  deleteMany(filter: TenantFilter<TDocument>, options?: DeleteOptions): Promise<DeleteResult>;
  deleteOne(filter: TenantFilter<TDocument>, options?: DeleteOptions): Promise<DeleteResult>;
  distinct(
    key: string,
    filter: TenantFilter<TDocument>,
    options?: DistinctOptions,
  ): Promise<unknown[]>;
  find(
    filter: TenantFilter<TDocument>,
    options?: FindOptions<TDocument>,
  ): FindCursor<WithId<TDocument>>;
  findOne(
    filter: TenantFilter<TDocument>,
    options?: FindOptions<TDocument>,
  ): Promise<WithId<TDocument> | null>;
  findOneAndUpdate(
    filter: TenantFilter<TDocument>,
    update: UpdateFilter<TDocument> | Document,
    options?: FindOneAndUpdateOptions,
  ): Promise<WithId<TDocument> | null>;
  insertMany(
    documents: OptionalUnlessRequiredId<TDocument>[],
    options?: BulkWriteOptions,
  ): Promise<InsertManyResult<TDocument>>;
  insertOne(
    document: OptionalUnlessRequiredId<TDocument>,
    options?: InsertOneOptions,
  ): Promise<InsertOneResult<TDocument>>;
  replaceOne(
    filter: TenantFilter<TDocument>,
    replacement: TDocument,
    options?: UpdateOptions,
  ): Promise<UpdateResult<TDocument>>;
  updateMany(
    filter: TenantFilter<TDocument>,
    update: UpdateFilter<TDocument> | Document,
    options?: UpdateOptions,
  ): Promise<UpdateResult<TDocument>>;
  updateOne(
    filter: TenantFilter<TDocument>,
    update: UpdateFilter<TDocument> | Document,
    options?: UpdateOptions,
  ): Promise<UpdateResult<TDocument>>;
};

function tenantIdFrom(value: unknown, operation: string) {
  const tenantId = typeof value === "string" ? value.trim() : "";
  if (!tenantId) throw new BadRequestError(`tenantId is required for ${operation}`);
  return tenantId;
}

function validateFilter(filter: unknown, operation: string) {
  if (!filter || typeof filter !== "object")
    throw new BadRequestError(`tenant filter is required for ${operation}`);
  return tenantIdFrom((filter as Record<string, unknown>).tenantId, operation);
}

function validateDocument(document: unknown, operation: string) {
  if (!document || typeof document !== "object")
    throw new BadRequestError(`tenant document is required for ${operation}`);
  return tenantIdFrom((document as Record<string, unknown>).tenantId, operation);
}

function validateUpdate(filter: unknown, update: unknown, operation: string) {
  const tenantId = validateFilter(filter, operation);
  if (!update || typeof update !== "object") return;
  const source = update as Record<string, unknown>;
  for (const operator of ["$set", "$setOnInsert"] as const) {
    const value = source[operator];
    if (!value || typeof value !== "object") continue;
    const changedTenant = (value as Record<string, unknown>).tenantId;
    if (changedTenant !== undefined && changedTenant !== tenantId) {
      throw new BadRequestError("tenantId cannot be changed by an update");
    }
  }
}

function validatePipeline(pipeline: unknown) {
  if (!Array.isArray(pipeline) || pipeline.length === 0) {
    throw new BadRequestError("tenant aggregate must start with a tenant $match stage");
  }
  validateFilter((pipeline[0] as Record<string, unknown>).$match, "aggregate");
}

function validateBulkOperations(operations: unknown) {
  if (!Array.isArray(operations)) throw new BadRequestError("bulk operations are required");
  for (const operation of operations as Array<Record<string, Record<string, unknown>>>) {
    if (operation.insertOne) validateDocument(operation.insertOne.document, "bulkWrite.insertOne");
    for (const name of ["updateOne", "updateMany"] as const) {
      if (operation[name])
        validateUpdate(operation[name].filter, operation[name].update, `bulkWrite.${name}`);
    }
    if (operation.replaceOne) {
      const tenantId = validateFilter(operation.replaceOne.filter, "bulkWrite.replaceOne");
      if (validateDocument(operation.replaceOne.replacement, "bulkWrite.replaceOne") !== tenantId) {
        throw new BadRequestError("replacement tenantId must match the query tenantId");
      }
    }
    for (const name of ["deleteOne", "deleteMany"] as const) {
      if (operation[name]) validateFilter(operation[name].filter, `bulkWrite.${name}`);
    }
  }
}

export function createTenantMongoCollection<TDocument extends TenantOwnedDocument>(
  collection: Collection<TDocument>,
): TenantMongoCollection<TDocument> {
  const validators: Record<string, (args: unknown[]) => void> = {
    aggregate: ([pipeline]) => validatePipeline(pipeline),
    bulkWrite: ([operations]) => validateBulkOperations(operations),
    countDocuments: ([filter]) => void validateFilter(filter, "countDocuments"),
    deleteMany: ([filter]) => void validateFilter(filter, "deleteMany"),
    deleteOne: ([filter]) => void validateFilter(filter, "deleteOne"),
    distinct: ([, filter]) => void validateFilter(filter, "distinct"),
    find: ([filter]) => void validateFilter(filter, "find"),
    findOne: ([filter]) => void validateFilter(filter, "findOne"),
    findOneAndUpdate: ([filter, update]) => validateUpdate(filter, update, "findOneAndUpdate"),
    insertMany: ([documents]) => {
      if (!Array.isArray(documents))
        throw new BadRequestError("tenant documents are required for insertMany");
      for (const document of documents) validateDocument(document, "insertMany");
    },
    insertOne: ([document]) => void validateDocument(document, "insertOne"),
    replaceOne: ([filter, replacement]) => {
      const tenantId = validateFilter(filter, "replaceOne");
      if (validateDocument(replacement, "replaceOne") !== tenantId)
        throw new BadRequestError("replacement tenantId must match the query tenantId");
    },
    updateMany: ([filter, update]) => validateUpdate(filter, update, "updateMany"),
    updateOne: ([filter, update]) => validateUpdate(filter, update, "updateOne"),
  };

  return new Proxy(collection, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (typeof value !== "function") return value;
      const validator = validators[String(property)];
      return (...args: unknown[]) => {
        validator?.(args);
        return Reflect.apply(value, target, args);
      };
    },
  }) as TenantMongoCollection<TDocument>;
}
