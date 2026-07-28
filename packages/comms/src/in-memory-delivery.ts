import type {
  InviteDeliveryPort,
  InviteDeliveryRecord,
  InviteDeliveryRepository,
  InviteEmailMessage,
  InviteEmailReceipt,
} from "./types";

function clone(record: InviteDeliveryRecord): InviteDeliveryRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    sentAt: new Date(record.sentAt),
  };
}

function newId(): string {
  return globalThis.crypto.randomUUID();
}

export function buildInviteEmailSubject(email: string, role: string): string {
  return `Invitation for ${email} as ${role}`;
}

export function buildInviteEmailText(message: InviteEmailMessage): string {
  return [
    `Invitation for ${message.email}`,
    `Role: ${message.role}`,
    `Invite: ${message.inviteUrl}`,
    message.createdBy ? `Created by: ${message.createdBy}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInviteEmailHtml(message: InviteEmailMessage): string {
  return [
    "<html><body>",
    `<h1>Invitation for ${message.email}</h1>`,
    `<p>Role: ${message.role}</p>`,
    `<p><a href=\"${message.inviteUrl}\">Accept invitation</a></p>`,
    message.createdBy ? `<p>Created by: ${message.createdBy}</p>` : undefined,
    "</body></html>",
  ]
    .filter(Boolean)
    .join("");
}

export class InMemoryInviteDelivery implements InviteDeliveryPort, InviteDeliveryRepository {
  private readonly records = new Map<string, InviteDeliveryRecord>();

  async sendInviteEmail(message: InviteEmailMessage): Promise<InviteEmailReceipt> {
    const sentAt = new Date();
    const record: InviteDeliveryRecord = {
      ...message,
      id: newId(),
      messageId: newId(),
      sentAt,
      createdAt: sentAt,
      updatedAt: sentAt,
    };
    this.records.set(record.id, clone(record));
    return {
      messageId: record.messageId,
      sentAt,
      provider: "memory",
    };
  }

  async list(): Promise<InviteDeliveryRecord[]> {
    return [...this.records.values()].map(clone);
  }

  async getById(id: string): Promise<InviteDeliveryRecord | null> {
    const record = this.records.get(id);
    return record ? clone(record) : null;
  }

  async create(input: InviteDeliveryRecord): Promise<InviteDeliveryRecord> {
    this.records.set(input.id, clone(input));
    return clone(input);
  }
}

export function createInMemoryInviteDelivery(): InMemoryInviteDelivery {
  return new InMemoryInviteDelivery();
}
