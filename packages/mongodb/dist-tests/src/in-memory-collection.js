"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryCollection = void 0;
exports.createInMemoryCollection = createInMemoryCollection;
function matchesFilter(document, filter = {}) {
    const entries = Object.entries(filter);
    return entries.every(([key, expected]) => {
        const actual = document[key];
        if (expected && typeof expected === "object" && "$in" in expected && Array.isArray(expected.$in)) {
            return expected.$in.some((candidate) => candidate === actual);
        }
        return actual === expected;
    });
}
class InMemoryCollection {
    name;
    records = new Map();
    constructor(name, initial = []) {
        this.name = name;
        for (const record of initial) {
            this.seed(record);
        }
    }
    seed(document) {
        this.records.set(String(document._id), structuredClone(document));
    }
    async findOne(filter = {}) {
        for (const record of this.records.values()) {
            if (matchesFilter(record, filter)) {
                return structuredClone(record);
            }
        }
        return null;
    }
    async findMany(filter = {}) {
        return [...this.records.values()].filter((record) => matchesFilter(record, filter)).map((record) => structuredClone(record));
    }
    async insertOne(document) {
        this.seed(document);
        return structuredClone(document);
    }
    async replaceOne(filter, document) {
        for (const [key, record] of this.records.entries()) {
            if (matchesFilter(record, filter)) {
                this.records.set(key, structuredClone(document));
                return structuredClone(document);
            }
        }
        return null;
    }
    async deleteOne(filter) {
        for (const [key, record] of this.records.entries()) {
            if (matchesFilter(record, filter)) {
                this.records.delete(key);
                return true;
            }
        }
        return false;
    }
}
exports.InMemoryCollection = InMemoryCollection;
function createInMemoryCollection(name, initial = []) {
    return new InMemoryCollection(name, initial);
}
