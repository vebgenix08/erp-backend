import type { ClientSession, MongoClient } from "mongodb";
import { getMongoClient } from "./connection";
import type { MongoEnvLike, RepositoryContext } from "./types";

export interface TransactionOptions {
  client?: MongoClient | undefined;
  env?: MongoEnvLike | undefined;
  context?: RepositoryContext | undefined;
}

export async function withTransaction<T>(
  work: (session: ClientSession | null, context?: RepositoryContext) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const client = options.client ?? (options.env ? await getMongoClient(options.env) : null);
  if (!client) {
    return work(null, options.context);
  }

  const session = client.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(session, options.context);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
