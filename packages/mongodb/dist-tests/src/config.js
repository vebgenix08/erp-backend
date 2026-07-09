"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMongoConfig = createMongoConfig;
const config_1 = require("@school-erp/config");
function getRuntimeEnv() {
    const runtime = globalThis;
    return runtime.process?.env ?? {};
}
function parseNumber(value, fallback) {
    if (value === undefined)
        return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function resolveMongoUri(stage, env) {
    const stageSpecificKey = stage === "prod" ? "MONGODB_URI_PROD" : stage === "test" ? "MONGODB_URI_TEST" : "MONGODB_URI_DEV";
    return env[stageSpecificKey] ?? env.MONGODB_URI ?? (0, config_1.requiredEnv)("MONGODB_URI", env);
}
function createMongoConfig(env = getRuntimeEnv()) {
    const appConfig = (0, config_1.createAppConfig)(env);
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
