import type { CampusCreateInput } from "../../campuses.model";

export function createCampusFixture(overrides: Partial<CampusCreateInput> = {}): CampusCreateInput {
  return {
    name: "Main Campus",
    address: "Main Address",
    ...overrides,
  };
}
