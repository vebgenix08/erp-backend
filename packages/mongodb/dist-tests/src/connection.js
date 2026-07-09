"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMongoConnection = getMongoConnection;
exports.getMongoClient = getMongoClient;
exports.getDb = getDb;
exports.closeMongoConnections = closeMongoConnections;
const mongodb_1 = require("mongodb");
const config_1 = require("./config");
const connectionCache = new Map();
function connectionKey(config) {
    return [
        config.uri,
        config.dbName,
        config.appName,
        config.maxPoolSize,
        config.minPoolSize,
        config.serverSelectionTimeoutMS,
    ].join("|");
}
async function createConnection(config) {
    const client = new mongodb_1.MongoClient(config.uri, {
        appName: config.appName,
        maxPoolSize: config.maxPoolSize,
        minPoolSize: config.minPoolSize,
        serverSelectionTimeoutMS: config.serverSelectionTimeoutMS,
    });
    await client.connect();
    return { client, dbName: config.dbName, config };
}
async function getMongoConnection(env) {
    const config = (0, config_1.createMongoConfig)(env);
    const key = connectionKey(config);
    const existing = connectionCache.get(key);
    if (existing) {
        return existing;
    }
    const created = createConnection(config);
    connectionCache.set(key, created);
    return created;
}
async function getMongoClient(env) {
    return (await getMongoConnection(env)).client;
}
async function getDb(env) {
    const connection = await getMongoConnection(env);
    return connection.client.db(connection.dbName);
}
async function closeMongoConnections() {
    const connections = [...connectionCache.values()];
    connectionCache.clear();
    await Promise.all(connections.map(async (connection) => {
        const resolved = await connection;
        await resolved.client.close();
    }));
}
