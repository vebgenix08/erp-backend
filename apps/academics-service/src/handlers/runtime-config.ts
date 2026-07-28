let hydration: Promise<void> | undefined;

function runtimeEnv(): Record<string, string | undefined> {
  return (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
}

function parseMongoUri(secret: string): string {
  const trimmed = secret.trim();
  if (trimmed.startsWith("mongodb://") || trimmed.startsWith("mongodb+srv://")) return trimmed;
  const parsed = JSON.parse(trimmed) as Record<string, unknown>;
  const value = parsed.uri ?? parsed.mongodbUri ?? parsed.MONGODB_URI;
  if (typeof value !== "string" || !value.trim()) throw new Error("MongoDB secret does not contain a URI");
  return value.trim();
}

export async function hydrateAcademicsRuntimeConfig(): Promise<void> {
  const env = runtimeEnv();
  if (env.MONGODB_URI) return;
  hydration ??= (async () => {
    const secretId = env.MONGODB_SECRET_NAME?.trim();
    if (!secretId) throw new Error("MONGODB_SECRET_NAME is required");
    const { GetSecretValueCommand, SecretsManagerClient } = await import("@aws-sdk/client-secrets-manager");
    const result = await new SecretsManagerClient(env.AWS_REGION ? { region: env.AWS_REGION } : {}).send(new GetSecretValueCommand({ SecretId: secretId }));
    if (!result.SecretString) throw new Error("MongoDB secret value is empty");
    env.MONGODB_URI = parseMongoUri(result.SecretString);
  })();
  await hydration;
}
