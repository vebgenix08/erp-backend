import type { CampusAcademicUnitCreateInput, CampusAcademicUnitRecord } from "../campus-academic-units/campus-academic-units.model";
import type { CampusCreateInput, CampusRecord } from "../campuses/campuses.model";

export interface CampusSetupCreateInput extends CampusCreateInput {
  academicUnits: CampusAcademicUnitCreateInput[];
}

export interface CampusSetupRecord {
  campus: CampusRecord;
  academicUnits: CampusAcademicUnitRecord[];
}

export interface CampusSetupView {
  campus: Omit<CampusRecord, "createdAt" | "updatedAt" | "deactivatedAt"> & {
    createdAt: string;
    updatedAt: string;
    deactivatedAt?: string | undefined;
  };
  academicUnits: Array<Omit<CampusAcademicUnitRecord, "createdAt" | "updatedAt" | "deactivatedAt"> & {
    createdAt: string;
    updatedAt: string;
    deactivatedAt?: string | undefined;
  }>;
}
