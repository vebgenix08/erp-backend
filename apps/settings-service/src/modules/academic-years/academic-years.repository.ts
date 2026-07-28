import { createMongoCollectionAdapter, getCollection, type CollectionAdapter, type MongoEnvLike, type RepositoryContext } from "@school-erp/mongodb";
import type { AcademicYearCreateInput, AcademicYearListFilter, AcademicYearRecord, AcademicYearStatus, AcademicYearUpdateInput } from "./academic-years.model";

export interface AcademicYearRepository {
  list(tenantId: string, filter?: AcademicYearListFilter, context?: RepositoryContext): Promise<AcademicYearRecord[]>;
  getById(tenantId: string, id: string, context?: RepositoryContext): Promise<AcademicYearRecord | null>;
  getByCode(tenantId: string, code: string, context?: RepositoryContext): Promise<AcademicYearRecord | null>;
  create(tenantId: string, input: AcademicYearCreateInput, context?: RepositoryContext): Promise<AcademicYearRecord>;
  update(tenantId: string, id: string, input: AcademicYearUpdateInput, context?: RepositoryContext): Promise<AcademicYearRecord | null>;
  activate(tenantId: string, id: string, context?: RepositoryContext): Promise<AcademicYearRecord | null>;
  close(tenantId: string, id: string, reason: string, context?: RepositoryContext): Promise<AcademicYearRecord | null>;
  reopen(tenantId: string, id: string, reason: string, context?: RepositoryContext): Promise<AcademicYearRecord | null>;
}

type TenantBucket = { records: Map<string, AcademicYearRecord> };

function clone(record: AcademicYearRecord): AcademicYearRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    activatedAt: record.activatedAt ? new Date(record.activatedAt) : undefined,
    deactivatedAt: record.deactivatedAt ? new Date(record.deactivatedAt) : undefined,
    closedAt: record.closedAt ? new Date(record.closedAt) : undefined,
    reopenedAt: record.reopenedAt ? new Date(record.reopenedAt) : undefined,
  };
}

function now() {
  return new Date();
}

export class InMemoryAcademicYearRepository implements AcademicYearRepository {
  private readonly buckets = new Map<string, TenantBucket>();

  private getBucket(tenantId: string): TenantBucket {
    let bucket = this.buckets.get(tenantId);
    if (!bucket) {
      bucket = { records: new Map<string, AcademicYearRecord>() };
      this.buckets.set(tenantId, bucket);
    }
    return bucket;
  }

  async list(tenantId: string, filter?: AcademicYearListFilter) {
    return [...this.getBucket(tenantId).records.values()]
      .filter((record) => !filter?.status || record.status === filter.status)
      .sort((left, right) => left.startDate.localeCompare(right.startDate) || left.code.localeCompare(right.code))
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

  async create(tenantId: string, input: AcademicYearCreateInput) {
    const timestamp = now();
    const record: AcademicYearRecord = {
      id: `academic_year_${tenantId}_${this.getBucket(tenantId).records.size + 1}`,
      tenantId,
      code: input.code,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      status: "DRAFT",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.getBucket(tenantId).records.set(record.id, record);
    return clone(record);
  }

  async update(tenantId: string, id: string, input: AcademicYearUpdateInput) {
    const bucket = this.getBucket(tenantId);
    const existing = bucket.records.get(id);
    if (!existing) return null;
    const updated: AcademicYearRecord = {
      ...existing,
      ...input,
      updatedAt: now(),
    };
    bucket.records.set(id, updated);
    return clone(updated);
  }

  async activate(tenantId: string, id: string) {
    const bucket = this.getBucket(tenantId);
    const existing = bucket.records.get(id);
    if (!existing) return null;
    const nowValue = now();
    for (const [recordId, record] of bucket.records.entries()) {
      bucket.records.set(recordId, {
        ...record,
        status: recordId === id ? "ACTIVE" : record.status === "ACTIVE" ? "CLOSED" : record.status,
        activatedAt: recordId === id ? nowValue : record.activatedAt,
        closedAt: recordId === id ? undefined : record.status === "ACTIVE" ? nowValue : record.closedAt,
        updatedAt: nowValue,
      });
    }
    return clone(bucket.records.get(id) as AcademicYearRecord);
  }
  async close(tenantId:string,id:string,reason:string){const existing=await this.getById(tenantId,id);if(!existing)return null;return this.updateRecord(tenantId,id,{...existing,status:"CLOSED",closedAt:now(),lifecycleReason:reason,updatedAt:now()});}
  async reopen(tenantId:string,id:string,reason:string){const existing=await this.getById(tenantId,id);if(!existing)return null;return this.updateRecord(tenantId,id,{...existing,status:"DRAFT",reopenedAt:now(),lifecycleReason:reason,updatedAt:now()});}
  private async updateRecord(tenantId:string,id:string,record:AcademicYearRecord){this.getBucket(tenantId).records.set(id,record);return clone(record);}
}

interface AcademicYearDocument extends Omit<AcademicYearRecord,"status"> { _id:string; normalizedCode:string; status:AcademicYearStatus|"INACTIVE"; }
export class MongoAcademicYearRepository implements AcademicYearRepository {
  constructor(private readonly collection:CollectionAdapter<AcademicYearDocument>){}
  private from(row:AcademicYearDocument|null){if(!row)return null;const{_id:_id,normalizedCode:_code,...record}=row;return clone({...record,status:record.status==="INACTIVE"?"DRAFT":record.status});}
  private doc(record:AcademicYearRecord):AcademicYearDocument{return{_id:record.id,...record,normalizedCode:record.code.toLowerCase()};}
  async list(tenantId:string,filter?:AcademicYearListFilter){const rows=await this.collection.findMany({tenantId,...(filter?.status?{status:filter.status}:{})},{sort:{startDate:1,code:1}});return rows.map((row)=>this.from(row) as AcademicYearRecord);}
  async getById(tenantId:string,id:string){return this.from(await this.collection.findOne({_id:id,tenantId}));}
  async getByCode(tenantId:string,code:string){return this.from(await this.collection.findOne({tenantId,normalizedCode:code.toLowerCase()}));}
  async create(tenantId:string,input:AcademicYearCreateInput){const timestamp=now();const record:AcademicYearRecord={id:`academic_year_${crypto.randomUUID()}`,tenantId,...input,status:"DRAFT",createdAt:timestamp,updatedAt:timestamp};await this.collection.insertOne(this.doc(record));return clone(record);}
  async update(tenantId:string,id:string,input:AcademicYearUpdateInput){const existing=await this.getById(tenantId,id);if(!existing)return null;const updated={...existing,...input,updatedAt:now()};await this.collection.replaceOne({_id:id,tenantId},this.doc(updated));return clone(updated);}
  async activate(tenantId:string,id:string){const existing=await this.getById(tenantId,id);if(!existing)return null;const rows=await this.list(tenantId);const timestamp=now();for(const row of rows){const updated:AcademicYearRecord={...row,status:row.id===id?"ACTIVE":row.status==="ACTIVE"?"CLOSED":row.status,activatedAt:row.id===id?timestamp:row.activatedAt,closedAt:row.id===id?undefined:row.status==="ACTIVE"?timestamp:row.closedAt,updatedAt:timestamp};await this.collection.replaceOne({_id:row.id,tenantId},this.doc(updated));}return this.getById(tenantId,id);}
  async close(tenantId:string,id:string,reason:string){const existing=await this.getById(tenantId,id);if(!existing)return null;const updated:AcademicYearRecord={...existing,status:"CLOSED",closedAt:now(),lifecycleReason:reason,updatedAt:now()};await this.collection.replaceOne({_id:id,tenantId},this.doc(updated));return clone(updated);}
  async reopen(tenantId:string,id:string,reason:string){const existing=await this.getById(tenantId,id);if(!existing)return null;const updated:AcademicYearRecord={...existing,status:"DRAFT",reopenedAt:now(),lifecycleReason:reason,updatedAt:now()};await this.collection.replaceOne({_id:id,tenantId},this.doc(updated));return clone(updated);}
}
function runtimeEnv():MongoEnvLike{return(globalThis as unknown as{process?:{env?:MongoEnvLike}}).process?.env??{};}let defaultRepository:Promise<AcademicYearRepository>|undefined;
export async function createAcademicYearRepository(env:MongoEnvLike=runtimeEnv()):Promise<AcademicYearRepository>{if(!env.MONGODB_URI&&!env.MONGODB_URI_DEV&&!env.MONGODB_URI_PROD&&!env.MONGODB_URI_TEST)return new InMemoryAcademicYearRepository();const collection=await getCollection<AcademicYearDocument>("settings_academic_years",env);await collection.createIndex({tenantId:1,normalizedCode:1},{unique:true});await collection.createIndex({tenantId:1,status:1},{unique:true,partialFilterExpression:{status:"ACTIVE"}});return new MongoAcademicYearRepository(createMongoCollectionAdapter(collection));}
async function getDefaultRepository(){defaultRepository??=createAcademicYearRepository();return defaultRepository;}
export const academicYearRepository:AcademicYearRepository={list:async(...a)=>(await getDefaultRepository()).list(...a),getById:async(...a)=>(await getDefaultRepository()).getById(...a),getByCode:async(...a)=>(await getDefaultRepository()).getByCode(...a),create:async(...a)=>(await getDefaultRepository()).create(...a),update:async(...a)=>(await getDefaultRepository()).update(...a),activate:async(...a)=>(await getDefaultRepository()).activate(...a),close:async(...a)=>(await getDefaultRepository()).close(...a),reopen:async(...a)=>(await getDefaultRepository()).reopen(...a)};
