import { getMongoConnection, type MongoEnvLike } from "@school-erp/mongodb";
import { issueConfiguredNumber } from "@school-erp/numbering";
import type { Collection } from "mongodb";
import type { StudentDocumentFilter, StudentDocumentRecord, StudentDocumentType } from "./student-documents.model";
export interface StudentDocumentRepository {
  nextNumber(tenantId: string, type: StudentDocumentType, idempotencyKey: string, year: number, campusId?: string, academicYearId?: string): Promise<string>;
  create(record: StudentDocumentRecord): Promise<StudentDocumentRecord>;
  getById(tenantId: string, id: string): Promise<StudentDocumentRecord | null>;
  list(tenantId: string, filter: StudentDocumentFilter): Promise<StudentDocumentRecord[]>;
  revoke(tenantId: string, id: string, actorId: string, reason: string): Promise<StudentDocumentRecord | null>;
}
interface Document extends StudentDocumentRecord { _id: string }
const clone = (value: StudentDocumentRecord): StudentDocumentRecord => ({ ...value, issuedAt: new Date(value.issuedAt), updatedAt: new Date(value.updatedAt), ...(value.validUntil ? { validUntil: new Date(value.validUntil) } : {}), ...(value.revokedAt ? { revokedAt: new Date(value.revokedAt) } : {}) });
const prefix = (type: StudentDocumentType) => ({ BONAFIDE_CERTIFICATE: "BON", STUDY_CERTIFICATE: "STU", TRANSFER_CERTIFICATE: "TC", STUDENT_ID_CARD: "IDC" })[type];
export class InMemoryStudentDocumentRepository implements StudentDocumentRepository {
  private records = new Map<string, StudentDocumentRecord>(); private sequences = new Map<string, number>();
  async nextNumber(tenantId: string, type: StudentDocumentType, idempotencyKey: string, year: number) { const key = `${tenantId}:${type}:${idempotencyKey}`;const existing=this.sequences.get(key);if(existing)return`${prefix(type)}/${year}/${String(existing).padStart(6,"0")}`;const scopeKey=`${tenantId}:${type}:${year}`,next=[...this.sequences.entries()].filter(([entry])=>entry.startsWith(`${tenantId}:${type}:`)).length+1;this.sequences.set(key,next);void scopeKey;return`${prefix(type)}/${year}/${String(next).padStart(6,"0")}`; }
  async create(record: StudentDocumentRecord) { this.records.set(record.id, clone(record)); return clone(record); }
  async getById(tenantId: string, id: string) { const value = this.records.get(id); return value?.tenantId === tenantId ? clone(value) : null; }
  async list(tenantId: string, filter: StudentDocumentFilter) { return [...this.records.values()].filter((r) => r.tenantId === tenantId && (!filter.studentId || r.studentId === filter.studentId) && (!filter.campusId || r.campusId === filter.campusId) && (!filter.academicYearId || r.academicYearId === filter.academicYearId) && (!filter.documentType || r.documentType === filter.documentType) && (!filter.status || r.status === filter.status)).sort((a,b)=>b.issuedAt.getTime()-a.issuedAt.getTime()).map(clone); }
  async revoke(tenantId: string, id: string, actorId: string, reason: string) { const current = await this.getById(tenantId,id); if(!current)return null; const at=new Date(); return this.create({...current,status:"REVOKED",revokedAt:at,revokedBy:actorId,revokeReason:reason,updatedAt:at}); }
}
class MongoStudentDocumentRepository implements StudentDocumentRepository {
  constructor(private collection: Collection<Document>, private counters: Collection<{_id:string;sequence:number}>){}
  async nextNumber(tenantId:string,type:StudentDocumentType,idempotencyKey:string,year:number,campusId?:string,academicYearId?:string){void year;void this.counters;return issueConfiguredNumber({tenantId,stream:type,idempotencyKey,...(campusId?{campusId}:{}),...(academicYearId?{academicYearId}:{})});}
  async create(record:StudentDocumentRecord){await this.collection.insertOne({...record,_id:record.id});return clone(record);}
  async getById(tenantId:string,id:string){const value=await this.collection.findOne({_id:id,tenantId});return value?clone(value):null;}
  async list(tenantId:string,filter:StudentDocumentFilter){const query:Record<string,unknown>={tenantId};for(const field of ["studentId","campusId","academicYearId","documentType","status"] as const)if(filter[field])query[field]=filter[field];return(await this.collection.find(query).sort({issuedAt:-1}).toArray()).map(clone);}
  async revoke(tenantId:string,id:string,actorId:string,reason:string){const at=new Date();const value=await this.collection.findOneAndUpdate({_id:id,tenantId,status:"ISSUED"},{$set:{status:"REVOKED",revokedAt:at,revokedBy:actorId,revokeReason:reason,updatedAt:at}},{returnDocument:"after"});return value?clone(value):null;}
}
let singleton:Promise<StudentDocumentRepository>|undefined;
export function studentDocumentRepository(){singleton??=(async()=>{const env=(globalThis as unknown as {process?:{env?:MongoEnvLike}}).process?.env??{};if(!env.MONGODB_URI&&!env.MONGODB_URI_DEV&&!env.MONGODB_URI_PROD&&!env.MONGODB_URI_TEST)return new InMemoryStudentDocumentRepository();const connection=await getMongoConnection(env);const db=connection.client.db(connection.dbName);const collection=db.collection<Document>("student_documents");await collection.createIndex({tenantId:1,studentId:1,issuedAt:-1});return new MongoStudentDocumentRepository(collection,db.collection("student_document_counters"));})();return singleton;}
