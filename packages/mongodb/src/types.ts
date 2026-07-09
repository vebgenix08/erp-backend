import type { ClientSession, Collection, Document, Filter, MongoClient } from "mongodb";

export interface MongoConfig {
  stage: "dev" | "prod" | "test";
  uri: string;
  dbName: string;
  appName: string;
  maxPoolSize: number;
  minPoolSize: number;
  serverSelectionTimeoutMS: number;
}

export interface MongoEnvLike {
  NODE_ENV?: string | undefined;
  STAGE?: string | undefined;
  APP_NAME?: string | undefined;
  SERVICE_NAME?: string | undefined;
  PORT?: string | undefined;
  MONGODB_URI?: string | undefined;
  MONGODB_URI_DEV?: string | undefined;
  MONGODB_URI_PROD?: string | undefined;
  MONGODB_URI_TEST?: string | undefined;
  MONGODB_DB_NAME?: string | undefined;
  MONGODB_APP_NAME?: string | undefined;
  MONGODB_MAX_POOL_SIZE?: string | undefined;
  MONGODB_MIN_POOL_SIZE?: string | undefined;
  MONGODB_SERVER_SELECTION_TIMEOUT_MS?: string | undefined;
  [key: string]: string | undefined;
}

export interface MongoConnectionState {
  client: MongoClient;
  dbName: string;
  config: MongoConfig;
}

export interface RepositoryContext {
  session?: ClientSession | undefined;
  requestId?: string | undefined;
  tenantId?: string | undefined;
  userId?: string | undefined;
}

export interface CollectionAdapter<TDocument extends Document> {
  readonly name: string;
  findOne(filter: Filter<TDocument>): Promise<TDocument | null>;
  findMany(filter?: Filter<TDocument>): Promise<TDocument[]>;
  insertOne(document: TDocument): Promise<TDocument>;
  replaceOne(filter: Filter<TDocument>, document: TDocument): Promise<TDocument | null>;
  deleteOne(filter: Filter<TDocument>): Promise<boolean>;
}

export interface PlatformRepository<TEntity, TCreate, TUpdate> {
  list(context?: RepositoryContext): Promise<TEntity[]>;
  getById(id: string, context?: RepositoryContext): Promise<TEntity | null>;
  create(input: TCreate, context?: RepositoryContext): Promise<TEntity>;
  update(id: string, input: TUpdate, context?: RepositoryContext): Promise<TEntity | null>;
}

export interface TenantScopedRepository<TEntity, TCreate, TUpdate> {
  list(tenantId: string, context?: RepositoryContext): Promise<TEntity[]>;
  getById(tenantId: string, id: string, context?: RepositoryContext): Promise<TEntity | null>;
  create(tenantId: string, input: TCreate, context?: RepositoryContext): Promise<TEntity>;
  update(tenantId: string, id: string, input: TUpdate, context?: RepositoryContext): Promise<TEntity | null>;
}
