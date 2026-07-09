import { MongoClient } from "mongodb";
import { createMongoConfig } from "./config";
import type { MongoConfig, MongoConnectionState, MongoEnvLike } from "./types";

const connectionCache = new Map<string, Promise<MongoConnectionState>>();

function connectionKey(config: MongoConfig): string {
  return [
    config.uri,
    config.dbName,
    config.appName,
    config.maxPoolSize,
    config.minPoolSize,
    config.serverSelectionTimeoutMS,
  ].join("|");
}

async function createConnection(config: MongoConfig): Promise<MongoConnectionState> {
  const client = new MongoClient(config.uri, {
    appName: config.appName,
    maxPoolSize: config.maxPoolSize,
    minPoolSize: config.minPoolSize,
    serverSelectionTimeoutMS: config.serverSelectionTimeoutMS,
  } as any);
  await client.connect();
  return { client, dbName: config.dbName, config };
}

export async function getMongoConnection(env?: MongoEnvLike): Promise<MongoConnectionState> {
  const config = createMongoConfig(env);
  const key = connectionKey(config);
  const existing = connectionCache.get(key);
  if (existing) {
    return existing;
  }
  const created = createConnection(config);
  connectionCache.set(key, created);
  return created;
}

export async function getMongoClient(env?: MongoEnvLike): Promise<MongoClient> {
  return (await getMongoConnection(env)).client;
}

export async function getDb(env?: MongoEnvLike) {
  const connection = await getMongoConnection(env);
  return connection.client.db(connection.dbName);
}

export async function closeMongoConnections(): Promise<void> {
  const connections = [...connectionCache.values()];
  connectionCache.clear();
  await Promise.all(
    connections.map(async (connection) => {
      const resolved = await connection;
      await resolved.client.close();
    }),
  );
}
