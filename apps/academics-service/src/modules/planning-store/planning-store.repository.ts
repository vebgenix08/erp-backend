import {
  createMongoCollectionAdapter,
  getCollection,
  getCollectionFromDb,
  getMongoClient,
  type CollectionAdapter,
  type MongoEnvLike,
} from "@school-erp/mongodb";

export const planningCollections = [
  "identity_employees", "settings_campuses", "settings_academic_years",
  "academics_programs", "subject_catalogue",
  "curriculum_subjects", "subject_components", "academic_year_subject_plans",
  "academics_classes", "academics_sections",
  "section_subject_exceptions", "subject_choice_groups", "student_subject_choices", "teaching_groups",
  "teaching_group_memberships", "subject_batches", "subject_batch_memberships", "subject_offerings",
  "parallel_timetable_blocks", "employee_campus_assignments",
  "teacher_subject_eligibility", "teaching_assignments_v2", "academic_responsibilities", "teacher_availability",
  "teacher_workload_policies", "rooms", "campus_travel_rules", "timetable_period_sets", "timetable_period_slots",
  "timetable_versions", "timetable_entries", "timetable_constraints", "timetable_validation_runs", "timetable_conflicts",
  "timetable_day_patterns", "timetable_temporary_overrides", "timetable_generation_runs",
] as const;
export type PlanningCollection = typeof planningCollections[number];
export interface PlanningDocument { _id: string; id: string; tenantId: string; [key: string]: unknown }

export interface PlanningStore {
  list(collection: PlanningCollection, tenantId: string, filter?: Record<string, unknown>): Promise<PlanningDocument[]>;
  get(collection: PlanningCollection, tenantId: string, id: string): Promise<PlanningDocument | null>;
  insert(collection: PlanningCollection, tenantId: string, document: PlanningDocument): Promise<PlanningDocument>;
  replace(collection: PlanningCollection, tenantId: string, id: string, expectedVersion: number, document: PlanningDocument): Promise<PlanningDocument | null>;
}

export class InMemoryPlanningStore implements PlanningStore {
  private readonly collections = new Map<PlanningCollection, Map<string, PlanningDocument>>();
  private collection(name: PlanningCollection) { let value = this.collections.get(name); if (!value) { value = new Map(); this.collections.set(name, value); } return value; }
  async list(collection: PlanningCollection, tenantId: string, filter: Record<string, unknown> = {}) {
    return [...this.collection(collection).values()].filter((document) => document.tenantId === tenantId && Object.entries(filter).every(([key, value]) => document[key] === value)).map((document) => structuredClone(document));
  }
  async get(collection: PlanningCollection, tenantId: string, id: string) { const document = this.collection(collection).get(id); return document?.tenantId === tenantId ? structuredClone(document) : null; }
  async insert(collection: PlanningCollection, tenantId: string, document: PlanningDocument) {
    if (document.tenantId !== tenantId) throw new Error("tenant mismatch"); this.collection(collection).set(document.id, structuredClone(document)); return structuredClone(document);
  }
  async replace(collection: PlanningCollection, tenantId: string, id: string, expectedVersion: number, document: PlanningDocument) {
    const current = await this.get(collection, tenantId, id); if (!current || current.version !== expectedVersion) return null;
    this.collection(collection).set(id, structuredClone(document)); return structuredClone(document);
  }
}

class MongoPlanningStore implements PlanningStore {
  private readonly adapters = new Map<PlanningCollection, Promise<CollectionAdapter<PlanningDocument>>>();
  constructor(private readonly runtime: MongoEnvLike) {}
  private adapter(name: PlanningCollection) {
    let adapter = this.adapters.get(name);
    if (!adapter) {
      adapter = (async () => {
        const environment = this.runtime.environment?.trim() || this.runtime.STAGE?.trim() || "dev";
        const referenceDatabase = name === "identity_employees"
          ? this.runtime.IDENTITY_MONGODB_DB_NAME?.trim() || `identity-service_${environment}`
          : ["settings_campuses", "settings_academic_years"].includes(name)
            ? this.runtime.SETTINGS_MONGODB_DB_NAME?.trim() || `settings-service_${environment}`
            : undefined;
        const collection = referenceDatabase
          ? getCollectionFromDb<PlanningDocument>((await getMongoClient(this.runtime)).db(referenceDatabase), name)
          : await getCollection<PlanningDocument>(name, this.runtime);
        if (!["identity_employees", "settings_campuses", "settings_academic_years", "academics_programs", "subject_catalogue"].includes(name)) {
          await collection.createIndex({ tenantId: 1, status: 1 });
          await collection.createIndex({ tenantId: 1, updatedAt: -1 });
        }
        return createMongoCollectionAdapter(collection);
      })();
      this.adapters.set(name, adapter);
    }
    return adapter;
  }
  async list(collection: PlanningCollection, tenantId: string, filter: Record<string, unknown> = {}) { return await (await this.adapter(collection)).findMany({ tenantId, ...filter }, { sort: { updatedAt: -1 } }); }
  async get(collection: PlanningCollection, tenantId: string, id: string) { return await (await this.adapter(collection)).findOne({ tenantId, _id: id }); }
  async insert(collection: PlanningCollection, tenantId: string, document: PlanningDocument) {
    if (document.tenantId !== tenantId) throw new Error("tenant mismatch"); return await (await this.adapter(collection)).insertOne(document);
  }
  async replace(collection: PlanningCollection, tenantId: string, id: string, expectedVersion: number, document: PlanningDocument) {
    return await (await this.adapter(collection)).replaceOne({ tenantId, _id: id, version: expectedVersion }, document);
  }
}
const env = (): MongoEnvLike => (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {};
let singleton: PlanningStore | undefined;
export function planningStore(runtime: MongoEnvLike = env()): PlanningStore {
  if (singleton) return singleton;
  singleton = !runtime.MONGODB_URI && !runtime.MONGODB_URI_DEV && !runtime.MONGODB_URI_PROD && !runtime.MONGODB_URI_TEST ? new InMemoryPlanningStore() : new MongoPlanningStore(runtime);
  return singleton;
}
