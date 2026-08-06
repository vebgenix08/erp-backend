import { createMongoCollectionAdapter,getCollection,type CollectionAdapter,type MongoEnvLike } from "@school-erp/mongodb";

export interface IdentityAuditRecord { id:string;tenantId:string;actorId:string;action:string;entityType:string;entityId:string;details?:Record<string,unknown>;createdAt:Date }
interface Document extends IdentityAuditRecord{_id:string}
export interface IdentityAuditRepository{append(record:IdentityAuditRecord):Promise<void>}
export class InMemoryIdentityAuditRepository implements IdentityAuditRepository{readonly records:IdentityAuditRecord[]=[];async append(record:IdentityAuditRecord){this.records.push(structuredClone(record))}}
class MongoIdentityAuditRepository implements IdentityAuditRepository{constructor(private collection:CollectionAdapter<Document>){}async append(record:IdentityAuditRecord){await this.collection.insertOne({...record,_id:record.id})}}
function env():MongoEnvLike{return(globalThis as unknown as{process?:{env?:MongoEnvLike}}).process?.env??{}}
let singleton:Promise<IdentityAuditRepository>|undefined;
export async function createIdentityAuditRepository(environment:MongoEnvLike=env()){if(!environment.MONGODB_URI&&!environment.MONGODB_URI_DEV&&!environment.MONGODB_URI_PROD&&!environment.MONGODB_URI_TEST)return new InMemoryIdentityAuditRepository();const collection=await getCollection<Document>("identity_access_audit",environment);await collection.createIndex({tenantId:1,createdAt:-1});await collection.createIndex({tenantId:1,entityType:1,entityId:1,createdAt:-1});return new MongoIdentityAuditRepository(createMongoCollectionAdapter(collection))}
export function identityAuditRepository(){singleton??=createIdentityAuditRepository();return singleton}
