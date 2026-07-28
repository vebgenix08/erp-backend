export type ReadinessStatus = "READY" | "ACTION_REQUIRED" | "OPTIONAL";

export interface ReadinessItemView {
  key: "INSTITUTION_PROFILE" | "ACTIVE_CAMPUS" | "ACTIVE_ACADEMIC_YEAR" | "PUBLISHED_TEMPLATE";
  label: string;
  status: ReadinessStatus;
  blocking: boolean;
  route: string;
  detail: string;
}

export interface TenantReadinessView {
  ready: boolean;
  completedRequired: number;
  totalRequired: number;
  percentage: number;
  items: ReadinessItemView[];
  evaluatedAt: string;
}
