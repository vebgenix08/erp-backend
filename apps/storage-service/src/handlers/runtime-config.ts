let hydration: Promise<void> | undefined;

function env(): Record<string, string | undefined> {
  return (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
}

function mongoUri(secret: string): string {
  const value = secret.trim();
  if (value.startsWith("mongodb://") || value.startsWith("mongodb+srv://")) return value;
  const parsed = JSON.parse(value) as Record<string, unknown>;
  const candidate = parsed.uri ?? parsed.mongodbUri ?? parsed.MONGODB_URI;
  if (typeof candidate !== "string" || !candidate.trim()) throw new Error("MongoDB secret does not contain a URI");
  return candidate.trim();
}

export async function hydrateStorageRuntimeConfig(): Promise<void> {
  const runtime = env();
  if (runtime.MONGODB_URI) return;
  hydration ??= (async () => {
    const secretId = runtime.MONGODB_SECRET_NAME?.trim();
    if (!secretId) throw new Error("MONGODB_SECRET_NAME is required");
    const { GetSecretValueCommand, SecretsManagerClient } = await import("@aws-sdk/client-secrets-manager");
    const result = await new SecretsManagerClient({}).send(new GetSecretValueCommand({ SecretId: secretId }));
    if (!result.SecretString) throw new Error("MongoDB secret value is empty");
    runtime.MONGODB_URI = mongoUri(result.SecretString);
  })();
  await hydration;
}
