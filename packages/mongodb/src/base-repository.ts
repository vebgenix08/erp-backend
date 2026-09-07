import type { Document, Filter } from "mongodb";
import { BadRequestError, NotFoundError } from "@school-erp/errors";
import type {
  CollectionAdapter,
  PlatformCollectionAdapter,
  RepositoryContext,
  TenantFilter,
  TenantOwnedDocument,
  TenantScopedRepository,
  PlatformRepository,
} from "./types";

export abstract class BaseRepository<TDocument extends Document> {
  protected readonly collection: PlatformCollectionAdapter<TDocument>;

  protected constructor(collection: PlatformCollectionAdapter<TDocument>) {
    this.collection = collection;
  }

  protected async findOne(filter: Filter<TDocument>) {
    return this.collection.findOne(filter);
  }

  protected async findMany(filter: Filter<TDocument> = {}) {
    return this.collection.findMany(filter);
  }

  protected async insertOne(document: TDocument, _context?: RepositoryContext) {
    return this.collection.insertOne(document);
  }

  protected async replaceOne(
    filter: Filter<TDocument>,
    document: TDocument,
    _context?: RepositoryContext,
  ) {
    return this.collection.replaceOne(filter, document);
  }

  protected async deleteOne(filter: Filter<TDocument>, _context?: RepositoryContext) {
    return this.collection.deleteOne(filter);
  }
}

export abstract class PlatformBaseRepository<TEntity, TCreate, TUpdate, TDocument extends Document>
  extends BaseRepository<TDocument>
  implements PlatformRepository<TEntity, TCreate, TUpdate>
{
  protected constructor(collection: PlatformCollectionAdapter<TDocument>) {
    super(collection);
  }

  abstract list(context?: RepositoryContext): Promise<TEntity[]>;
  abstract getById(id: string, context?: RepositoryContext): Promise<TEntity | null>;
  abstract create(input: TCreate, context?: RepositoryContext): Promise<TEntity>;
  abstract update(id: string, input: TUpdate, context?: RepositoryContext): Promise<TEntity | null>;
}

export abstract class TenantScopedBaseRepository<
    TEntity,
    TCreate,
    TUpdate,
    TDocument extends Document,
  >
  extends BaseRepository<TDocument>
  implements TenantScopedRepository<TEntity, TCreate, TUpdate>
{
  protected readonly tenantCollection: CollectionAdapter<TDocument & TenantOwnedDocument>;

  protected constructor(collection: CollectionAdapter<TDocument & TenantOwnedDocument>) {
    super(collection as unknown as PlatformCollectionAdapter<TDocument>);
    this.tenantCollection = collection;
  }

  protected requireTenantId(tenantId: string | undefined): string {
    const normalized = typeof tenantId === "string" ? tenantId.trim() : "";
    if (!normalized) {
      throw new BadRequestError("tenantId is required");
    }
    return normalized;
  }

  protected tenantFilter(
    tenantId: string,
    filter: Filter<TDocument> = {},
  ): TenantFilter<TDocument & TenantOwnedDocument> {
    return { ...(filter as Record<string, unknown>), tenantId } as TenantFilter<
      TDocument & TenantOwnedDocument
    >;
  }

  protected assertTenantOwnership(
    document: { tenantId?: string | undefined },
    tenantId: string,
  ): void {
    if (document.tenantId !== tenantId) {
      throw new NotFoundError("Tenant-scoped record not found");
    }
  }

  abstract list(tenantId: string, context?: RepositoryContext): Promise<TEntity[]>;
  abstract getById(
    tenantId: string,
    id: string,
    context?: RepositoryContext,
  ): Promise<TEntity | null>;
  abstract create(tenantId: string, input: TCreate, context?: RepositoryContext): Promise<TEntity>;
  abstract update(
    tenantId: string,
    id: string,
    input: TUpdate,
    context?: RepositoryContext,
  ): Promise<TEntity | null>;
}

export function createTenantScopeFilter<TFilter extends Record<string, unknown>>(
  tenantId: string,
  filter: TFilter = {} as TFilter,
): TFilter & { tenantId: string } {
  const normalized = typeof tenantId === "string" ? tenantId.trim() : "";
  if (!normalized) {
    throw new BadRequestError("tenantId is required");
  }
  return { ...filter, tenantId: normalized };
}
