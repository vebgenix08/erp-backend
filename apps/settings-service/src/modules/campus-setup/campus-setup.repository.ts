import { BadRequestError, ConflictError } from "@school-erp/errors";
import { getMongoConnection, type MongoEnvLike, withTransaction } from "@school-erp/mongodb";
import type { Collection, ClientSession } from "mongodb";
import type { CampusAcademicUnitRecord } from "../campus-academic-units/campus-academic-units.model";
import type { CampusRecord } from "../campuses/campuses.model";
import type { CampusSetupCreateInput, CampusSetupRecord } from "./campus-setup.model";

export interface CampusSetupRepository {
  create(tenantId: string, input: CampusSetupCreateInput): Promise<CampusSetupRecord>;
}
const normalizeTenant = (value: string) => { const result = value.trim(); if (!result) throw new BadRequestError("tenantId is required"); return result; };
const normalizedName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
const unitKey = (campusId: string, type: string, affiliationId: string) => `${campusId}:${type}:${affiliationId}`.toLowerCase();
const clone = (record: CampusSetupRecord): CampusSetupRecord => ({
  campus: { ...record.campus, createdAt: new Date(record.campus.createdAt), updatedAt: new Date(record.campus.updatedAt), deactivatedAt: record.campus.deactivatedAt ? new Date(record.campus.deactivatedAt) : undefined },
  academicUnits: record.academicUnits.map((unit) => ({ ...unit, createdAt: new Date(unit.createdAt), updatedAt: new Date(unit.updatedAt), deactivatedAt: unit.deactivatedAt ? new Date(unit.deactivatedAt) : undefined })),
});

export class InMemoryCampusSetupRepository implements CampusSetupRepository {
  readonly campuses = new Map<string, CampusRecord>();
  readonly academicUnits = new Map<string, CampusAcademicUnitRecord>();
  private readonly sequences = new Map<string, number>();
  async create(tenantId: string, input: CampusSetupCreateInput) {
    const tenant = normalizeTenant(tenantId);
    if ([...this.campuses.values()].some((campus) => campus.tenantId === tenant && normalizedName(campus.name) === normalizedName(input.name))) throw new ConflictError("campus name must be unique within the tenant");
    const next = (this.sequences.get(tenant) ?? 0) + 1; this.sequences.set(tenant, next);
    const timestamp = new Date(); const campusId = `campus_${crypto.randomUUID()}`;
    const campus: CampusRecord = { id: campusId, tenantId: tenant, code: `CAMP-${String(next).padStart(3, "0")}`, name: input.name, status: "ACTIVE", address: input.address, contactEmail: input.contactEmail, contactPhone: input.contactPhone, createdAt: timestamp, updatedAt: timestamp };
    const units = input.academicUnits.map((item) => {
      const id = `unit_${crypto.randomUUID()}`;
      return { id, tenantId: tenant, campusId, code: `UNIT-${id.slice(-6).toUpperCase()}`, ...item, status: "ACTIVE" as const, createdAt: timestamp, updatedAt: timestamp };
    });
    this.campuses.set(campus.id, campus); for (const unit of units) this.academicUnits.set(unit.id, unit);
    return clone({ campus, academicUnits: units });
  }
}

interface CampusDocument extends CampusRecord { _id: string; normalizedCode: string; normalizedName: string }
interface UnitDocument extends CampusAcademicUnitRecord { _id: string; unitKey: string }
interface SequenceDocument { _id: string; value: number }
class MongoCampusSetupRepository implements CampusSetupRepository {
  constructor(
    private readonly campuses: Collection<CampusDocument>,
    private readonly units: Collection<UnitDocument>,
    private readonly sequences: Collection<SequenceDocument>,
    private readonly env: MongoEnvLike,
  ) {}
  async create(tenantId: string, input: CampusSetupCreateInput) {
    const tenant = normalizeTenant(tenantId);
    return withTransaction(async (session) => this.createInTransaction(tenant, input, session ?? undefined), { env: this.env, context: { tenantId: tenant } });
  }
  private async createInTransaction(tenantId: string, input: CampusSetupCreateInput, session?: ClientSession) {
    const options = session ? { session } : {};
    if (await this.campuses.findOne({ tenantId, normalizedName: normalizedName(input.name) }, options)) throw new ConflictError("campus name must be unique within the tenant");
    const sequence = await this.sequences.findOneAndUpdate({ _id: `campus:${tenantId}` }, { $inc: { value: 1 } }, { upsert: true, returnDocument: "after", includeResultMetadata: false, ...options });
    const timestamp = new Date(); const campusId = `campus_${crypto.randomUUID()}`;
    const campus: CampusRecord = { id: campusId, tenantId, code: `CAMP-${String(sequence?.value ?? 1).padStart(3, "0")}`, name: input.name, status: "ACTIVE", address: input.address, contactEmail: input.contactEmail, contactPhone: input.contactPhone, createdAt: timestamp, updatedAt: timestamp };
    await this.campuses.insertOne({ _id: campus.id, ...campus, normalizedCode: campus.code.toLowerCase(), normalizedName: normalizedName(campus.name) }, options);
    const academicUnits: CampusAcademicUnitRecord[] = input.academicUnits.map((item) => {
      const id = `unit_${crypto.randomUUID()}`;
      return { id, tenantId, campusId, code: `UNIT-${id.slice(-6).toUpperCase()}`, ...item, status: "ACTIVE", createdAt: timestamp, updatedAt: timestamp };
    });
    if (academicUnits.length) await this.units.insertMany(academicUnits.map((unit) => ({ _id: unit.id, ...unit, unitKey: unitKey(unit.campusId, unit.type, unit.curriculumOrAffiliationId) })), options);
    return clone({ campus, academicUnits });
  }
}
const runtimeEnv = (): MongoEnvLike => (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {};
const hasMongo = (env: MongoEnvLike) => Boolean(env.MONGODB_URI || env.MONGODB_URI_DEV || env.MONGODB_URI_PROD || env.MONGODB_URI_TEST);
export async function createCampusSetupRepository(env: MongoEnvLike = runtimeEnv()): Promise<CampusSetupRepository> {
  if (!hasMongo(env)) return new InMemoryCampusSetupRepository();
  const connection = await getMongoConnection(env); const db = connection.client.db(connection.dbName);
  const campuses = db.collection<CampusDocument>("settings_campuses");
  const units = db.collection<UnitDocument>("settings_campus_academic_units");
  await campuses.createIndex({ tenantId: 1, normalizedCode: 1 }, { unique: true });
  await campuses.createIndex(
    { tenantId: 1, normalizedName: 1 },
    { unique: true, partialFilterExpression: { normalizedName: { $type: "string" } } },
  );
  await units.createIndex({ tenantId: 1, unitKey: 1 }, { unique: true });
  return new MongoCampusSetupRepository(campuses, units, db.collection<SequenceDocument>("settings_sequences"), env);
}
let singleton: Promise<CampusSetupRepository> | undefined;
export const campusSetupRepository: CampusSetupRepository = { create: async (...args) => (await (singleton ??= createCampusSetupRepository())).create(...args) };
