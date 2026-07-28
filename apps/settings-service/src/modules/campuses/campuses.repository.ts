import { createMongoCollectionAdapter, getCollection, type CollectionAdapter, type MongoEnvLike, type RepositoryContext } from "@school-erp/mongodb";
import type { CampusCreateInput, CampusListFilter, CampusRecord, CampusUpdateInput } from "./campuses.model";

export interface CampusRepository {
  list(tenantId: string, filter?: CampusListFilter, context?: RepositoryContext): Promise<CampusRecord[]>;
  getById(tenantId: string, id: string, context?: RepositoryContext): Promise<CampusRecord | null>;
  getByCode(tenantId: string, code: string, context?: RepositoryContext): Promise<CampusRecord | null>;
  create(tenantId: string, input: CampusCreateInput & { code: string }, context?: RepositoryContext): Promise<CampusRecord>;
  reserveNextCode(tenantId: string, context?: RepositoryContext): Promise<string>;
  update(tenantId: string, id: string, input: CampusUpdateInput, context?: RepositoryContext): Promise<CampusRecord | null>;
  deactivate(tenantId: string, id: string, context?: RepositoryContext): Promise<CampusRecord | null>;
  reactivate(tenantId: string, id: string, context?: RepositoryContext): Promise<CampusRecord | null>;
}

type TenantBucket = {
  records: Map<string, CampusRecord>;
  sequence: number;
};

function clone(record: CampusRecord): CampusRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    deactivatedAt: record.deactivatedAt ? new Date(record.deactivatedAt) : undefined,
  };
}

function now() {
  return new Date();
}

export class InMemoryCampusRepository implements CampusRepository {
  private readonly buckets = new Map<string, TenantBucket>();

  private getBucket(tenantId: string): TenantBucket {
    let bucket = this.buckets.get(tenantId);
    if (!bucket) {
      bucket = { records: new Map<string, CampusRecord>(), sequence: 0 };
      this.buckets.set(tenantId, bucket);
    }
    return bucket;
  }

  async list(tenantId: string, filter?: CampusListFilter) {
    const records = [...this.getBucket(tenantId).records.values()];
    return records
      .filter((record) => !filter?.status || record.status === filter.status)
      .filter((record) => !filter?.campusType || record.campusType === filter.campusType)
      .filter((record) => !filter?.search || [record.name, record.address, record.contactEmail, record.contactPhone].some((value) => value?.toLowerCase().includes(filter.search!.toLowerCase())))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(clone);
  }

  async getById(tenantId: string, id: string) {
    const record = this.getBucket(tenantId).records.get(id);
    return record ? clone(record) : null;
  }

  async getByCode(tenantId: string, code: string) {
    const record = [...this.getBucket(tenantId).records.values()].find((item) => item.code.toLowerCase() === code.toLowerCase());
    return record ? clone(record) : null;
  }

  async reserveNextCode(tenantId: string) { const bucket=this.getBucket(tenantId); bucket.sequence+=1; return `CAMP-${String(bucket.sequence).padStart(3,"0")}`; }

  async create(tenantId: string, input: CampusCreateInput & { code: string }) {
    const timestamp = now();
    const record: CampusRecord = {
      id: `campus_${tenantId}_${this.getBucket(tenantId).records.size + 1}`,
      tenantId,
      code: input.code,
      name: input.name,
      campusType: input.campusType,
      status: "ACTIVE",
      address: input.address,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.getBucket(tenantId).records.set(record.id, record);
    return clone(record);
  }

  async update(tenantId: string, id: string, input: CampusUpdateInput) {
    const bucket = this.getBucket(tenantId);
    const existing = bucket.records.get(id);
    if (!existing) return null;
    const updated: CampusRecord = {
      ...existing,
      ...input,
      updatedAt: now(),
      deactivatedAt: input.status === "INACTIVE" ? existing.deactivatedAt ?? now() : input.status === "ACTIVE" ? undefined : existing.deactivatedAt,
    };
    bucket.records.set(id, updated);
    return clone(updated);
  }

  async deactivate(tenantId: string, id: string) {
    return this.update(tenantId, id, { status: "INACTIVE" });
  }
  async reactivate(tenantId: string, id: string) { return this.update(tenantId, id, { status: "ACTIVE" }); }
}

interface CampusDocument extends CampusRecord { _id: string; normalizedCode: string; normalizedName: string; }
interface SequenceDocument { _id: string; value: number; }
export class MongoCampusRepository implements CampusRepository {
  constructor(private readonly collection:CollectionAdapter<CampusDocument>,private readonly sequence:Awaited<ReturnType<typeof getCollection<SequenceDocument>>>){}
  private from(row:CampusDocument|null){if(!row)return null;const{_id:_id,normalizedCode:_code,normalizedName:_name,...record}=row;return clone(record);}
  private doc(record:CampusRecord):CampusDocument{return{_id:record.id,...record,normalizedCode:record.code.toLowerCase(),normalizedName:record.name.trim().toLowerCase().replace(/\s+/g," ")};}
  async list(tenantId:string,filter?:CampusListFilter){const rows=await this.collection.findMany({tenantId,...(filter?.status?{status:filter.status}:{}),...(filter?.campusType?{campusType:filter.campusType}:{})},{sort:{name:1}});return rows.map((row)=>this.from(row) as CampusRecord).filter((record)=>!filter?.search||[record.name,record.address,record.contactEmail,record.contactPhone].some((value)=>value?.toLowerCase().includes(filter.search!.toLowerCase())));}
  async getById(tenantId:string,id:string){return this.from(await this.collection.findOne({_id:id,tenantId}));}
  async getByCode(tenantId:string,code:string){return this.from(await this.collection.findOne({tenantId,normalizedCode:code.toLowerCase()}));}
  async reserveNextCode(tenantId:string){const result=await this.sequence.findOneAndUpdate({_id:`campus:${tenantId}`},{$inc:{value:1}}, {upsert:true,returnDocument:"after"});return `CAMP-${String(result?.value??1).padStart(3,"0")}`;}
  async create(tenantId:string,input:CampusCreateInput&{code:string}){const timestamp=now();const record:CampusRecord={id:`campus_${crypto.randomUUID()}`,tenantId,...input,status:"ACTIVE",createdAt:timestamp,updatedAt:timestamp};await this.collection.insertOne(this.doc(record));return clone(record);}
  async update(tenantId:string,id:string,input:CampusUpdateInput){const existing=await this.getById(tenantId,id);if(!existing)return null;const updated:CampusRecord={...existing,...input,updatedAt:now(),deactivatedAt:input.status==="INACTIVE"?existing.deactivatedAt??now():input.status==="ACTIVE"?undefined:existing.deactivatedAt};await this.collection.replaceOne({_id:id,tenantId},this.doc(updated));return clone(updated);}
  async deactivate(tenantId:string,id:string){return this.update(tenantId,id,{status:"INACTIVE"});}
  async reactivate(tenantId:string,id:string){return this.update(tenantId,id,{status:"ACTIVE"});}
}
function runtimeEnv():MongoEnvLike{return(globalThis as unknown as{process?:{env?:MongoEnvLike}}).process?.env??{};} let defaultRepository:Promise<CampusRepository>|undefined;
export async function createCampusRepository(env:MongoEnvLike=runtimeEnv()):Promise<CampusRepository>{if(!env.MONGODB_URI&&!env.MONGODB_URI_DEV&&!env.MONGODB_URI_PROD&&!env.MONGODB_URI_TEST)return new InMemoryCampusRepository();const collection=await getCollection<CampusDocument>("settings_campuses",env);const sequence=await getCollection<SequenceDocument>("settings_sequences",env);await collection.createIndex({tenantId:1,normalizedCode:1},{unique:true});await collection.createIndex({tenantId:1,normalizedName:1},{unique:true,partialFilterExpression:{normalizedName:{$type:"string"}}});return new MongoCampusRepository(createMongoCollectionAdapter(collection),sequence);}
async function getDefaultRepository(){defaultRepository??=createCampusRepository();return defaultRepository;}
export const campusRepository:CampusRepository={list:async(...a)=>(await getDefaultRepository()).list(...a),getById:async(...a)=>(await getDefaultRepository()).getById(...a),getByCode:async(...a)=>(await getDefaultRepository()).getByCode(...a),create:async(...a)=>(await getDefaultRepository()).create(...a),reserveNextCode:async(...a)=>(await getDefaultRepository()).reserveNextCode(...a),update:async(...a)=>(await getDefaultRepository()).update(...a),deactivate:async(...a)=>(await getDefaultRepository()).deactivate(...a),reactivate:async(...a)=>(await getDefaultRepository()).reactivate(...a)};
