import { BadRequestError } from "@school-erp/errors";
import type { TenantScopedRepository } from "@school-erp/mongodb";
import { createMongoCollectionAdapter, getCollection, type CollectionAdapter, type MongoEnvLike } from "@school-erp/mongodb";
import { normalizeTenantId } from "@school-erp/tenancy";
import type { EnquiryCreateStoredInput, EnquiryListFilter, EnquiryPage, EnquiryRecord, EnquiryUpdateStoredInput } from "./enquiry.model";

export interface EnquiryRepository
  extends Omit<TenantScopedRepository<EnquiryRecord, EnquiryCreateStoredInput, EnquiryUpdateStoredInput>, "list"> {
  getByEnquiryNumber(tenantId: string, enquiryNumber: string): Promise<EnquiryRecord | null>;
  nextEnquirySequence(tenantId: string): Promise<number>;
  close(tenantId: string, id: string, input: { status: "CLOSED"; closedAt: Date; updatedAt: Date }): Promise<EnquiryRecord | null>;
  list(tenantId: string, filter?: EnquiryListFilter): Promise<EnquiryRecord[]>;
  listPage(tenantId: string, filter?: EnquiryListFilter): Promise<EnquiryPage>;
}

type TenantBucket = {
  sequence: number;
  enquiries: Map<string, EnquiryRecord>;
};

function createBucket(): TenantBucket {
  return {
    sequence: 0,
    enquiries: new Map<string, EnquiryRecord>(),
  };
}

function clone(enquiry: EnquiryRecord): EnquiryRecord {
  return {
    ...enquiry,
    customFields: enquiry.customFields ? { ...enquiry.customFields } : undefined,
    dateOfBirth: enquiry.dateOfBirth ? new Date(enquiry.dateOfBirth) : undefined,
    createdAt: new Date(enquiry.createdAt),
    updatedAt: new Date(enquiry.updatedAt),
    closedAt: enquiry.closedAt ? new Date(enquiry.closedAt) : undefined,
  };
}

function sortByCreatedAt(left: EnquiryRecord, right: EnquiryRecord): number {
  return left.createdAt.getTime() - right.createdAt.getTime() || left.enquiryNumber.localeCompare(right.enquiryNumber);
}

function normalizeFilter(filter?: EnquiryListFilter): EnquiryListFilter {
  return {
    status: filter?.status,
    campusId: filter?.campusId,
    academicYearId: filter?.academicYearId,
    source: filter?.source?.trim().toLowerCase() || undefined,
    search: filter?.search?.trim().toLowerCase() || undefined,
    limit: filter?.limit,
    offset: filter?.offset,
  };
}

function matchesSearch(enquiry: EnquiryRecord, search: string): boolean {
  const haystack = [
    enquiry.enquiryNumber,
    enquiry.studentName,
    enquiry.parentName,
    enquiry.phone,
    enquiry.email,
    enquiry.interestedClass,
    enquiry.source,
    enquiry.notes,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();
  return haystack.includes(search);
}

export class InMemoryEnquiryRepository implements EnquiryRepository {
  private readonly buckets = new Map<string, TenantBucket>();

  private getBucket(tenantId: string): TenantBucket {
    const normalizedTenantId = normalizeTenantId(tenantId);
    if (!normalizedTenantId) {
      throw new BadRequestError("tenantId is required");
    }
    let bucket = this.buckets.get(normalizedTenantId);
    if (!bucket) {
      bucket = createBucket();
      this.buckets.set(normalizedTenantId, bucket);
    }
    return bucket;
  }

  async list(tenantId: string, filter?: EnquiryListFilter) {
    return (await this.listPage(tenantId, filter)).items;
  }
  async listPage(tenantId: string, filter?: EnquiryListFilter) {
    const normalizedFilter = normalizeFilter(filter);
    const rows = [...this.getBucket(tenantId).enquiries.values()]
      .filter((enquiry) => {
        if (normalizedFilter.campusId && enquiry.campusId !== normalizedFilter.campusId) return false;
        if (normalizedFilter.academicYearId && enquiry.academicYearId !== normalizedFilter.academicYearId) return false;
        if (normalizedFilter.status && enquiry.status !== normalizedFilter.status) return false;
        if (normalizedFilter.source && enquiry.source?.trim().toLowerCase() !== normalizedFilter.source) return false;
        if (normalizedFilter.search && !matchesSearch(enquiry, normalizedFilter.search)) return false;
        return true;
      })
      .sort(sortByCreatedAt);
    const offset = normalizedFilter.offset ?? 0;
    const limit = normalizedFilter.limit ?? 25;
    return { items: rows.slice(offset, offset + limit).map(clone), total: rows.length, limit, offset };
  }

  async getById(tenantId: string, id: string) {
    return this.getBucket(tenantId).enquiries.get(id) ? clone(this.getBucket(tenantId).enquiries.get(id) as EnquiryRecord) : null;
  }

  async getByEnquiryNumber(tenantId: string, enquiryNumber: string) {
    const record = [...this.getBucket(tenantId).enquiries.values()].find((item) => item.enquiryNumber === enquiryNumber);
    return record ? clone(record) : null;
  }

  async nextEnquirySequence(tenantId: string) {
    const bucket = this.getBucket(tenantId);
    bucket.sequence += 1;
    return bucket.sequence;
  }

  async create(tenantId: string, input: EnquiryCreateStoredInput) {
    if (!input.enquiryNumber) {
      throw new BadRequestError("enquiryNumber is required");
    }
    const bucket = this.getBucket(tenantId);
    const id = `enquiry_${tenantId}_${bucket.sequence}`;
    const record: EnquiryRecord = {
      id,
      tenantId: normalizeTenantId(tenantId) as string,
      enquiryNumber: input.enquiryNumber,
      campusId: input.campusId,
      academicYearId: input.academicYearId,
      academicTargetId: input.academicTargetId,
      studentName: input.studentName,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      parentName: input.parentName,
      phone: input.phone,
      email: input.email,
      interestedClass: input.interestedClass,
      source: input.source,
      status: input.status,
      notes: input.notes,
      templateId: input.templateId,
      templateVersion: input.templateVersion,
      customFields: input.customFields ? { ...input.customFields } : undefined,
      createdBy: input.createdBy,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      closedAt: input.closedAt,
    };
    bucket.enquiries.set(id, record);
    return clone(record);
  }

  async update(tenantId: string, id: string, input: EnquiryUpdateStoredInput) {
    const bucket = this.getBucket(tenantId);
    const existing = bucket.enquiries.get(id);
    if (!existing) return null;
    const updated: EnquiryRecord = {
      ...existing,
      tenantId: existing.tenantId,
      id: existing.id,
      enquiryNumber: existing.enquiryNumber,
      createdBy: existing.createdBy,
      createdAt: existing.createdAt,
      updatedAt: input.updatedAt,
      closedAt: input.closedAt ?? existing.closedAt,
      status: input.status ?? existing.status,
      studentName: input.studentName ?? existing.studentName,
      dateOfBirth: input.dateOfBirth ?? existing.dateOfBirth,
      gender: input.gender ?? existing.gender,
      parentName: input.parentName ?? existing.parentName,
      phone: input.phone ?? existing.phone,
      email: input.email ?? existing.email,
      interestedClass: input.interestedClass ?? existing.interestedClass,
      source: input.source ?? existing.source,
      notes: input.notes ?? existing.notes,
    };
    bucket.enquiries.set(id, updated);
    return clone(updated);
  }

  async close(tenantId: string, id: string, input: { status: "CLOSED"; closedAt: Date; updatedAt: Date }) {
    const bucket = this.getBucket(tenantId);
    const existing = bucket.enquiries.get(id);
    if (!existing) return null;
    const updated: EnquiryRecord = {
      ...existing,
      status: "CLOSED",
      closedAt: input.closedAt,
      updatedAt: input.updatedAt,
    };
    bucket.enquiries.set(id, updated);
    return clone(updated);
  }
}

interface EnquiryDocument extends EnquiryRecord { _id: string; }
interface SequenceDocument { _id: string; value: number; }
const toDocument=(record:EnquiryRecord):EnquiryDocument=>({...clone(record),_id:record.id});
const fromDocument=(document:EnquiryDocument|null):EnquiryRecord|null=>{if(!document)return null;const{_id,...record}=document;return clone({...record,id:record.id||_id})};
function requiredTenant(tenantId:string){const value=normalizeTenantId(tenantId);if(!value)throw new BadRequestError("tenantId is required");return value}
class MongoEnquiryRepository implements EnquiryRepository {
  constructor(private collection:CollectionAdapter<EnquiryDocument>,private sequences:Awaited<ReturnType<typeof getCollection<SequenceDocument>>>){}
  async nextEnquirySequence(tenantId:string){const result=await this.sequences.findOneAndUpdate({_id:`enquiry:${requiredTenant(tenantId)}`},{$inc:{value:1}},{upsert:true,returnDocument:"after"});return result?.value??1}
  async list(tenantId:string,filter?:EnquiryListFilter){return(await this.listPage(tenantId,filter)).items}
  async listPage(tenantId:string,filter?:EnquiryListFilter){const normalized=normalizeFilter(filter),query:Record<string,unknown>={tenantId:requiredTenant(tenantId)};if(normalized.campusId)query.campusId=normalized.campusId;if(normalized.academicYearId)query.academicYearId=normalized.academicYearId;if(normalized.status)query.status=normalized.status;if(normalized.source)query.source={$regex:`^${normalized.source.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}$`,$options:"i"};if(normalized.search)query.$or=["enquiryNumber","studentName","parentName","phone","email","interestedClass","source","notes"].map(field=>({[field]:{$regex:normalized.search,$options:"i"}}));const offset=normalized.offset??0,limit=normalized.limit??25;const[documents,total]=await Promise.all([this.collection.findMany(query,{sort:{createdAt:1,enquiryNumber:1},skip:offset,limit}),this.collection.count(query)]);return{items:documents.map(fromDocument).filter((record):record is EnquiryRecord=>Boolean(record)),total,limit,offset}}
  async getById(tenantId:string,id:string){return fromDocument(await this.collection.findOne({tenantId:requiredTenant(tenantId),_id:id}))}
  async getByEnquiryNumber(tenantId:string,enquiryNumber:string){return fromDocument(await this.collection.findOne({tenantId:requiredTenant(tenantId),enquiryNumber}))}
  async create(tenantId:string,input:EnquiryCreateStoredInput){const normalized=requiredTenant(tenantId),record:EnquiryRecord={id:`enquiry_${crypto.randomUUID()}`,tenantId:normalized,enquiryNumber:input.enquiryNumber,...(input.campusId?{campusId:input.campusId}:{}),...(input.academicYearId?{academicYearId:input.academicYearId}:{}),...(input.academicTargetId?{academicTargetId:input.academicTargetId}:{}),studentName:input.studentName,...(input.dateOfBirth?{dateOfBirth:input.dateOfBirth}:{}),...(input.gender?{gender:input.gender}:{}),parentName:input.parentName,phone:input.phone,...(input.email?{email:input.email}:{}),...(input.interestedClass?{interestedClass:input.interestedClass}:{}),...(input.source?{source:input.source}:{}),status:input.status,...(input.notes?{notes:input.notes}:{}),...(input.templateId?{templateId:input.templateId}:{}),...(input.templateVersion?{templateVersion:input.templateVersion}:{}),...(input.customFields?{customFields:{...input.customFields}}:{}),createdBy:input.createdBy,createdAt:input.createdAt,updatedAt:input.updatedAt,...(input.closedAt?{closedAt:input.closedAt}:{})};await this.collection.insertOne(toDocument(record));return clone(record)}
  async update(tenantId:string,id:string,input:EnquiryUpdateStoredInput){const existing=await this.getById(tenantId,id);if(!existing)return null;const updated:EnquiryRecord={...existing,...input,id:existing.id,tenantId:existing.tenantId,enquiryNumber:existing.enquiryNumber,studentName:input.studentName??existing.studentName,parentName:input.parentName??existing.parentName,phone:input.phone??existing.phone,createdBy:existing.createdBy,createdAt:existing.createdAt,status:input.status??existing.status,updatedAt:input.updatedAt};return await this.collection.replaceOne({tenantId:requiredTenant(tenantId),_id:id},toDocument(updated))?clone(updated):null}
  async close(tenantId:string,id:string,input:{status:"CLOSED";closedAt:Date;updatedAt:Date}){const existing=await this.getById(tenantId,id);if(!existing)return null;const updated:EnquiryRecord={...existing,status:"CLOSED",closedAt:input.closedAt,updatedAt:input.updatedAt};return await this.collection.replaceOne({tenantId:requiredTenant(tenantId),_id:id},toDocument(updated))?clone(updated):null}
}
function runtimeEnv():MongoEnvLike{return(globalThis as unknown as{process?:{env?:MongoEnvLike}}).process?.env??{}}
function hasMongo(env:MongoEnvLike){return Boolean(env.MONGODB_URI||env.MONGODB_URI_DEV||env.MONGODB_URI_PROD||env.MONGODB_URI_TEST)}
export async function createEnquiryRepository(env:MongoEnvLike=runtimeEnv()):Promise<EnquiryRepository>{if(!hasMongo(env))return new InMemoryEnquiryRepository();const collection=await getCollection<EnquiryDocument>("admissions_enquiries",env),sequences=await getCollection<SequenceDocument>("admissions_sequences",env);await collection.createIndex({tenantId:1,enquiryNumber:1},{unique:true});await collection.createIndex({tenantId:1,status:1,createdAt:-1});await collection.createIndex({tenantId:1,phone:1});return new MongoEnquiryRepository(createMongoCollectionAdapter(collection),sequences)}
let singleton:Promise<EnquiryRepository>|undefined;function defaultRepository(){return singleton??=createEnquiryRepository()}
export const enquiryRepository:EnquiryRepository={list:async(...args)=>(await defaultRepository()).list(...args),listPage:async(...args)=>(await defaultRepository()).listPage(...args),getById:async(...args)=>(await defaultRepository()).getById(...args),getByEnquiryNumber:async(...args)=>(await defaultRepository()).getByEnquiryNumber(...args),nextEnquirySequence:async(...args)=>(await defaultRepository()).nextEnquirySequence(...args),create:async(...args)=>(await defaultRepository()).create(...args),update:async(...args)=>(await defaultRepository()).update(...args),close:async(...args)=>(await defaultRepository()).close(...args)};
