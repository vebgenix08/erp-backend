export type StaffCategory = "TEACHING" | "NON_TEACHING";
export type StaffType = "PRINCIPAL" | "VICE_PRINCIPAL" | "DEAN" | "HOD" | "TEACHER" | "LECTURER" | "LAB_FACULTY" | "ADMIN_STAFF" | "SUPPORT_STAFF" | "OTHER";
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "VISITING";
export type EmployeeStatus = "ACTIVE" | "INACTIVE" | "ENDED";
export type EmployeeLoginStatus = "NONE" | "INVITED" | "ACTIVE" | "DISABLED" | "FAILED";

export interface EmployeeRecord {
  id: string; tenantId: string; employeeCode: string; fullName: string; email?: string | undefined; phone?: string | undefined;
  staffCategory: StaffCategory; staffType: StaffType; employmentType: EmploymentType; designation?: string | undefined; department?: string | undefined;
  primaryCampusId: string; campusIds: string[]; joiningDate: Date; status: EmployeeStatus; loginStatus: EmployeeLoginStatus;
  userId?: string | undefined; cognitoUsername?: string | undefined; inviteAttempts: number; inviteError?: string | undefined; lastInviteAttemptAt?: Date | undefined; invitedAt?: Date | undefined;
  pendingRoleIds?: string[] | undefined; pendingScopeType?: "TENANT" | "CAMPUS" | undefined;
  externalHrCode?: string | undefined; templateId?: string | undefined; templateVersion?: number | undefined; customFields?: Record<string, unknown> | undefined;
  createdBy: string; updatedBy: string; createdAt: Date; updatedAt: Date; endedAt?: Date | undefined; endReason?: string | undefined;
}

export interface EmployeeCreateInput {
  fullName: string; email?: string | undefined; phone?: string | undefined; staffCategory: StaffCategory; staffType: StaffType; employmentType: EmploymentType;
  designation?: string | undefined; department?: string | undefined; primaryCampusId: string; campusIds: string[]; joiningDate: Date; loginEnabled: boolean;
  roleIds: string[]; scopeType: "TENANT" | "CAMPUS"; externalHrCode?: string | undefined; templateId?: string | undefined; templateVersion?: number | undefined; customFields?: Record<string, unknown> | undefined;
}
export interface EmployeeListFilter { search?: string | undefined; status?: EmployeeStatus | undefined; staffCategory?: StaffCategory | undefined; campusId?: string | undefined; loginStatus?: EmployeeLoginStatus | undefined; }
export interface StaffIdentityGateway {
  invite(input: { email: string; fullName: string; tenantId: string; roleCode: string }): Promise<{ username: string; subject?: string | undefined }>;
  resend(email: string): Promise<void>;
  get(email: string): Promise<{ username: string; subject?: string | undefined; tenantId?: string | undefined; roleCode?: string | undefined }>;
  disable(email: string): Promise<void>;
}

export type EmployeeInviteAttemptStatus="SENT"|"FAILED";
export interface EmployeeInviteAttempt{ id:string;tenantId:string;employeeId:string;email:string;attemptNumber:number;status:EmployeeInviteAttemptStatus;provider:"COGNITO";error?:string|undefined;createdBy:string;createdAt:Date; }
