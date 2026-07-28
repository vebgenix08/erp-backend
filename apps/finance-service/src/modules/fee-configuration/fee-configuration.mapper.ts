import type {
  FeeConfigurationSnapshot,
  FeeHeadRecord,
  FeeMappingRecord,
  FeeScheduleRecord,
  FeeStructureRecord,
} from "./fee-configuration.model";

const dates = <T extends { createdAt: Date; updatedAt: Date }>(record: T) => ({
  ...record,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});
export const toFeeHeadView = (record: FeeHeadRecord) => dates(record);
export const toScheduleView = (record: FeeScheduleRecord) =>
  dates({
    ...record,
    collectionPolicy: record.collectionPolicy ?? "PARTIAL_ALLOWED",
  });
export const toStructureView = (record: FeeStructureRecord) =>
  dates({
    ...record,
    components: record.components.map((component, index) => ({
      ...component,
      allocationPriority: component.allocationPriority ?? index + 1,
    })),
  });
export const toMappingView = (record: FeeMappingRecord) => dates(record);
export const toConfigurationView = (snapshot: FeeConfigurationSnapshot) => ({
  feeHeads: snapshot.feeHeads.map(toFeeHeadView),
  schedules: snapshot.schedules.map(toScheduleView),
  structures: snapshot.structures.map(toStructureView),
  mappings: snapshot.mappings.map(toMappingView),
});
