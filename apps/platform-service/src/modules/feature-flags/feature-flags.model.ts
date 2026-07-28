export type FeatureFlagStatus = "ACTIVE" | "INACTIVE";

export interface FeatureFlagRecord {
  id: string;
  code: string;
  name: string;
  description?: string | undefined;
  isEnabled: boolean;
  status: FeatureFlagStatus;
  createdAt: Date;
  updatedAt: Date;
  deactivatedAt?: Date | undefined;
}

export interface FeatureFlagCreateInput {
  code: string;
  name: string;
  description?: string | undefined;
  isEnabled?: boolean | undefined;
}

export interface FeatureFlagUpdateInput {
  name?: string | undefined;
  description?: string | undefined;
  isEnabled?: boolean | undefined;
  status?: FeatureFlagStatus | undefined;
}

export interface FeatureFlagView {
  id: string;
  code: string;
  name: string;
  description?: string | undefined;
  isEnabled: boolean;
  status: FeatureFlagStatus;
  createdAt: string;
  updatedAt: string;
  deactivatedAt?: string | undefined;
}
