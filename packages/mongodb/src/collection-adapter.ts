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
    async findMany(filter: Filter<TDocument> = {}) {
      return (await collection.find(filter).toArray()) as TDocument[];
    },
    async insertOne(document: TDocument) {
      await collection.insertOne(document as OptionalUnlessRequiredId<TDocument>);
      return document;
    },
    async replaceOne(filter: Filter<TDocument>, document: TDocument) {
      const result = await collection.replaceOne(filter, document, { upsert: false });
      return result.matchedCount > 0 ? document : null;
    },
    async deleteOne(filter: Filter<TDocument>) {
      const result = await collection.deleteOne(filter);
      return result.deletedCount > 0;
    },
  };
}
