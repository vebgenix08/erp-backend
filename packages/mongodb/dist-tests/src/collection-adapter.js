"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMongoCollectionAdapter = createMongoCollectionAdapter;
function createMongoCollectionAdapter(collection) {
    return {
        name: collection.collectionName,
        async findOne(filter) {
            return (await collection.findOne(filter));
        },
        async findMany(filter = {}) {
            return (await collection.find(filter).toArray());
        },
        async insertOne(document) {
            await collection.insertOne(document);
            return document;
        },
        async replaceOne(filter, document) {
            const result = await collection.replaceOne(filter, document, { upsert: false });
            return result.matchedCount > 0 ? document : null;
        },
        async deleteOne(filter) {
            const result = await collection.deleteOne(filter);
            return result.deletedCount > 0;
        },
    };
}
