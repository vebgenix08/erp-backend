import { createMongoCollectionAdapter, getCollection, type CollectionAdapter, type MongoEnvLike } from "@school-erp/mongodb";

export interface EmployeeDeliveryEvent {
  _id:string;
  id:string;
  messageId:string;
  eventType:"SEND"|"DELIVERY"|"DELIVERY_DELAY"|"BOUNCE"|"COMPLAINT"|"REJECT"|"RENDERING_FAILURE";
  occurredAt:Date;
  recipients:string[];
}
export interface EmployeeDeliveryEventRepository { listByRecipient(email:string,limit?:number):Promise<EmployeeDeliveryEvent[]> }
class MongoEmployeeDeliveryEventRepository implements EmployeeDeliveryEventRepository {
  constructor(private readonly collection:CollectionAdapter<EmployeeDeliveryEvent>){}
  async listByRecipient(email:string,limit=50){return this.collection.findMany({recipients:email.toLowerCase()} as never,{sort:{occurredAt:-1},limit})}
}
function runtimeEnv():MongoEnvLike{return(globalThis as unknown as{process?:{env?:MongoEnvLike}}).process?.env??{}}
let singleton:Promise<EmployeeDeliveryEventRepository>|undefined;
export async function createEmployeeDeliveryEventRepository(environment:MongoEnvLike=runtimeEnv()){const collection=await getCollection<EmployeeDeliveryEvent>("comms_email_delivery_events",environment);return new MongoEmployeeDeliveryEventRepository(createMongoCollectionAdapter(collection))}
export function employeeDeliveryEventRepository(){singleton??=createEmployeeDeliveryEventRepository();return singleton}
