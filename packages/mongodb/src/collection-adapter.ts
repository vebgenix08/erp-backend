import type { Collection, Document, Filter, OptionalUnlessRequiredId } from "mongodb";
import type { CollectionAdapter } from "./types";

export function createMongoCollectionAdapter<TDocument extends Document>(
  collection: Collection<TDocument>,
): CollectionAdapter<TDocument> {
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
      const result = await collection.replaceOne(filter, document, { upsert: false });
      return result.matchedCount > 0 ? document : null;
    },
    async findOneAndUpdate(filter: Filter<TDocument>, update: Document, options = {}) {
      return await collection.findOneAndUpdate(filter, update, {
        upsert: options.upsert ?? false,
        returnDocument: options.returnDocument ?? "after",
        includeResultMetadata: false,
      }) as TDocument | null;
    },
    async deleteOne(filter: Filter<TDocument>) {
      const result = await collection.deleteOne(filter);
      return result.deletedCount > 0;
    },
  };
}
