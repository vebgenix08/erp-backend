export type PlatformIntegrationCode = "EMAIL" | "SMS" | "PAYMENTS" | "STORAGE";
export type PlatformIntegrationStatus = "CONFIGURED" | "DISABLED" | "DEGRADED";
export interface PlatformIntegrationRecord {
  id: string;
  code: PlatformIntegrationCode;
  status: PlatformIntegrationStatus;
  secretReference?: string | undefined;
  settings: Record<string, string | boolean | number>;
  createdAt: Date;
  updatedAt: Date;
}
export interface PlatformIntegrationInput {
  code: PlatformIntegrationCode;
  status: PlatformIntegrationStatus;
  secretReference?: string | undefined;
  settings?: Record<string, string | boolean | number> | undefined;
}
