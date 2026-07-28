import { BadRequestError, NotFoundError } from "@school-erp/errors";
import {
  createMongoCollectionAdapter,
  getMongoConnection,
  type CollectionAdapter,
  type MongoEnvLike,
} from "@school-erp/mongodb";

interface AcademicYearReferenceDocument extends Record<string, unknown> {
  _id: string;
  tenantId: string;
  code: string;
}

export interface AcademicYearReferenceReader {
  getCode(tenantId: string, academicYearId: string): Promise<string>;
}

class MongoAcademicYearReferenceReader implements AcademicYearReferenceReader {
  constructor(
    private readonly collection: CollectionAdapter<AcademicYearReferenceDocument>,
  ) {}
  async getCode(tenantId: string, academicYearId: string) {
    const record = await this.collection.findOne({
      tenantId,
      _id: academicYearId,
    });
    if (!record)
      throw new NotFoundError("academic year was not found for this tenant");
    return normalizeAcademicYearCode(record.code);
  }
}

export function normalizeAcademicYearCode(value: string) {
  const matched = value.trim().match(/^(\d{2,4})\D+(\d{2,4})$/);
  if (!matched)
    throw new BadRequestError("academic year code must identify a year range");
  return `${String(Number(matched[1]) % 100).padStart(2, "0")}-${String(Number(matched[2]) % 100).padStart(2, "0")}`;
}

function runtimeEnv(): MongoEnvLike {
  return (
    (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process
      ?.env ?? {}
  );
}

export async function createAcademicYearReferenceReader(
  env: MongoEnvLike = runtimeEnv(),
): Promise<AcademicYearReferenceReader> {
  const connection = await getMongoConnection(env);
  const settingsDatabaseName = env.SETTINGS_MONGODB_DB_NAME?.trim();
  if (!settingsDatabaseName) {
    throw new BadRequestError("SETTINGS_MONGODB_DB_NAME is not configured");
  }
  const collection = connection.client
    .db(settingsDatabaseName)
    .collection<AcademicYearReferenceDocument>("settings_academic_years");
  return new MongoAcademicYearReferenceReader(
    createMongoCollectionAdapter(collection),
  );
}

let singleton: Promise<AcademicYearReferenceReader> | undefined;
export function academicYearReferenceReader() {
  singleton ??= createAcademicYearReferenceReader();
  return singleton;
}
