export interface AdminDashboardScope {
  campusId: string;
  academicYearId: string;
  from: Date;
  to: Date;
}

export interface AdminDashboardActivity {
  id: string;
  occurredAt: Date;
  activity: string;
  module: "ADMISSIONS" | "FINANCE";
  subject: string;
  performedBy: string;
  status: string;
}

export interface AdminDashboardDistribution {
  key: string;
  label: string;
  count: number;
}

export interface AdminDashboardTrendPoint {
  period: string;
  label: string;
  value: number;
}

export interface AdminDashboardApplication {
  id: string;
  applicationNumber?: string;
  studentName: string;
  phone?: string;
  status: string;
  updatedAt: Date;
}

export interface AdminDashboardPaymentMethod {
  method: string;
  paymentCount: number;
  amountMinor: number;
}

export interface AdminDashboardOutstandingClass {
  classId: string;
  className: string;
  studentCount: number;
  outstandingMinor: number;
}

export interface AdminDashboardSecurityChange {
  id: string;
  change: string;
  subject: string;
  occurredAt: Date;
  status: string;
}

export interface AdminDashboardSnapshot {
  activeStudents: number;
  activeStaff: number;
  applicationsAwaitingAction: number;
  admissionsConfirmed: number;
  collectedTodayMinor: number;
  outstandingMinor: number;
  openWorkItems: number;
  studentsMissingSections: number;
  studentsMissingFeeOrders: number;
  enquiriesToday: number;
  pendingEnquiryFollowUps: number;
  applicationsSubmittedToday: number;
  paymentsToday: number;
  unpaidStudents: number;
  failedStaffInvites: number;
  failedFinanceEvents: number;
  failedAdmissionEvents: number;
  applicationCount: number;
  applicationStatusDistribution: AdminDashboardDistribution[];
  studentClassDistribution: AdminDashboardDistribution[];
  admissionsTrend: AdminDashboardTrendPoint[];
  collectionTrend: AdminDashboardTrendPoint[];
  collectionByPaymentMethod: AdminDashboardPaymentMethod[];
  topOutstandingClasses: AdminDashboardOutstandingClass[];
  recentSecurityChanges: AdminDashboardSecurityChange[];
  recentApplications: AdminDashboardApplication[];
  recentActivity: AdminDashboardActivity[];
  generatedAt: Date;
}
