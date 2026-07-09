export type Stage = "dev" | "prod" | "test";

export interface EnvLike {
  NODE_ENV?: string | undefined;
  STAGE?: string | undefined;
  APP_NAME?: string | undefined;
  SERVICE_NAME?: string | undefined;
  PORT?: string | undefined;
  [key: string]: string | undefined;
}

export interface AppConfig {
  stage: Stage;
  appName: string;
  serviceName: string;
  port: number;
}

function getRuntimeEnv(): EnvLike {
  const runtime = globalThis as unknown as { process?: { env?: EnvLike } };
  return runtime.process?.env ?? {};
}

export function loadStage(value: string | undefined): Stage {
  if (value === "prod" || value === "production") return "prod";
  if (value === "test") return "test";
  return "dev";
}

export function requiredEnv(name: string, env: EnvLike = getRuntimeEnv()): string {
  const value = env[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export function createAppConfig(env: EnvLike = getRuntimeEnv()): AppConfig {
  const stage = loadStage(env.STAGE ?? env.NODE_ENV);
  return {
    stage,
    appName: env.APP_NAME?.trim() || "school-erp",
    serviceName: env.SERVICE_NAME?.trim() || "platform-service",
    port: Number.parseInt(env.PORT ?? "3000", 10) || 3000,
  };
}

export const appConfig = createAppConfig();
