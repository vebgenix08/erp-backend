import type { ApplicationRecord, ApplicationView } from "./application.model";

export function toApplicationView(record: ApplicationRecord | null): ApplicationView | null {
  if (!record) return null;
  const { pendingEvents: _pendingEvents, ...publicRecord } = record;
  return {
    ...publicRecord,
    dateOfBirth: record.dateOfBirth?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    submittedAt: record.submittedAt?.toISOString(),
    approvedAt: record.approvedAt?.toISOString(),
    rejectedAt: record.rejectedAt?.toISOString(),
    confirmedAt: record.confirmedAt?.toISOString(),
    cancelledAt: record.cancelledAt?.toISOString(),
    reviews: record.reviews.map((review) => ({ ...review, reviewedAt: review.reviewedAt.toISOString() })),
    stageHistory: record.stageHistory.map((entry) => ({ ...entry, at: entry.at.toISOString() })),
  };
}
