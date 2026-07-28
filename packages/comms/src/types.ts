export interface InviteEmailMessage {
  inviteId: string;
  tenantId: string;
  email: string;
  role: string;
  inviteUrl: string;
  subject: string;
  text: string;
  html: string;
  createdBy?: string | undefined;
}

export interface InviteEmailReceipt {
  messageId: string;
  sentAt: Date;
  provider: "memory";
}

export interface InviteDeliveryRecord extends InviteEmailMessage {
  id: string;
  messageId: string;
  sentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InviteDeliveryRepository {
  list(): Promise<InviteDeliveryRecord[]>;
  getById(id: string): Promise<InviteDeliveryRecord | null>;
  create(input: InviteDeliveryRecord): Promise<InviteDeliveryRecord>;
}

export interface InviteDeliveryPort {
  sendInviteEmail(message: InviteEmailMessage): Promise<InviteEmailReceipt>;
}
