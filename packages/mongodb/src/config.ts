import { createAppConfig, requiredEnv, type Stage } from "@school-erp/config";
import type { MongoConfig, MongoEnvLike } from "./types";

function getRuntimeEnv(): MongoEnvLike {
  const runtime = globalThis as unknown as { process?: { env?: MongoEnvLike } };
  return runtime.process?.env ?? {};
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveMongoUri(stage: Stage, env: MongoEnvLike): string {
  const stageSpecificKey =
    stage === "prod" ? "MONGODB_URI_PROD" : stage === "test" ? "MONGODB_URI_TEST" : "MONGODB_URI_DEV";
  return env[stageSpecificKey] ?? env.MONGODB_URI ?? requiredEnv("MONGODB_URI", env);
}

export function createMongoConfig(env: MongoEnvLike = getRuntimeEnv()): MongoConfig {
  const appConfig = createAppConfig(env);
  return {
    stage: appConfig.stage,
    uri: resolveMongoUri(appConfig.stage, env),
    dbName: env.MONGODB_DB_NAME?.trim() || `${appConfig.serviceName}_${appConfig.stage}`,
    appName: env.MONGODB_APP_NAME?.trim() || appConfig.serviceName,
    maxPoolSize: parseNumber(env.MONGODB_MAX_POOL_SIZE, 10),
    minPoolSize: parseNumber(env.MONGODB_MIN_POOL_SIZE, 0),
    serverSelectionTimeoutMS: parseNumber(env.MONGODB_SERVER_SELECTION_TIMEOUT_MS, 5000),
  };
}
