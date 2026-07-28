import type { EmployeeRecord } from "./employees.model";
export function toEmployeeView(record:EmployeeRecord){return{...record,joiningDate:record.joiningDate.toISOString(),createdAt:record.createdAt.toISOString(),updatedAt:record.updatedAt.toISOString(),lastInviteAttemptAt:record.lastInviteAttemptAt?.toISOString(),invitedAt:record.invitedAt?.toISOString(),endedAt:record.endedAt?.toISOString()};}
