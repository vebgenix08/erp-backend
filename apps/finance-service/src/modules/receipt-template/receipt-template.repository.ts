import { getMongoConnection, type MongoEnvLike } from "@school-erp/mongodb";
import type { Collection } from "mongodb";
import type { ReceiptTemplateInput, ReceiptTemplateRecord } from "./receipt-template.model";

interface Document extends ReceiptTemplateRecord { _id: string }
export interface ReceiptTemplateRepository {
  get(tenantId: string): Promise<ReceiptTemplateRecord | null>;
  save(tenantId: string, actorId: string, input: ReceiptTemplateInput): Promise<ReceiptTemplateRecord>;
}
export const defaultReceiptTemplate = (tenantId: string): ReceiptTemplateRecord => ({
  id: `receipt_template_${tenantId}`,
  tenantId,
  title: "Fee payment receipt",
  signatureLabel: "Authorized signature",
  paperSize: "A4",
  accentColor: "#176b55",
  showInstitutionLogo: true,
  showInstitutionAddress: true,
  showPaymentMethod: true,
  showPaymentReference: true,
  updatedBy: "system",
  createdAt: new Date(0),
  updatedAt: new Date(0),
});
function clone(value: ReceiptTemplateRecord) { return { ...value, createdAt: new Date(value.createdAt), updatedAt: new Date(value.updatedAt) }; }
export class InMemoryReceiptTemplateRepository implements ReceiptTemplateRepository {
  private readonly records = new Map<string, ReceiptTemplateRecord>();
  async get(tenantId: string) { const value = this.records.get(tenantId); return value ? clone(value) : null; }
  async save(tenantId: string, actorId: string, input: ReceiptTemplateInput) { const existing = this.records.get(tenantId); const now = new Date(); const record = { ...input, id: `receipt_template_${tenantId}`, tenantId, updatedBy: actorId, createdAt: existing?.createdAt ?? now, updatedAt: now }; this.records.set(tenantId, clone(record)); return clone(record); }
}
class MongoReceiptTemplateRepository implements ReceiptTemplateRepository {
  constructor(private readonly collection: Collection<Document>) {}
  async get(tenantId: string) { const value = await this.collection.findOne({ tenantId }); return value ? clone(value) : null; }
  async save(tenantId: string, actorId: string, input: ReceiptTemplateInput) { const existing = await this.get(tenantId); const now = new Date(); const record: ReceiptTemplateRecord = { ...input, id: `receipt_template_${tenantId}`, tenantId, updatedBy: actorId, createdAt: existing?.createdAt ?? now, updatedAt: now }; await this.collection.updateOne({ tenantId }, { $set: record, $setOnInsert: { _id: record.id } }, { upsert: true }); return clone(record); }
}
function env(): MongoEnvLike { return (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {}; }
let singleton: Promise<ReceiptTemplateRepository> | undefined;
export function receiptTemplateRepository(): Promise<ReceiptTemplateRepository> {
  singleton ??= (async () => { const runtime = env(); if (!runtime.MONGODB_URI && !runtime.MONGODB_URI_DEV && !runtime.MONGODB_URI_PROD && !runtime.MONGODB_URI_TEST) return new InMemoryReceiptTemplateRepository(); const connection = await getMongoConnection(runtime); const collection = connection.client.db(connection.dbName).collection<Document>("finance_receipt_templates"); await collection.createIndex({ tenantId: 1 }, { unique: true }); return new MongoReceiptTemplateRepository(collection); })();
  return singleton;
}
