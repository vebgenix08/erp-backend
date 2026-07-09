import type { CampusCreateInput } from "../../campuses.model";

export function createCampusFixture(overrides: Partial<CampusCreateInput> = {}): CampusCreateInput {
  return {
    code: "MAIN",
    name: "Main Campus",
    campusType: "SCHOOL",
    address: "Main Address",
    ...overrides,
  };
}
