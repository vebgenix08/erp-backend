import type { FeatureFlagRecord, FeatureFlagView } from "./feature-flags.model";

function iso(value: Date | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

export function toFeatureFlagView(record: FeatureFlagRecord | null): FeatureFlagView | null {
  if (!record) return null;
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    description: record.description,
    isEnabled: record.isEnabled,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deactivatedAt: iso(record.deactivatedAt),
  };
}
