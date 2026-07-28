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
  recentActivity: AdminDashboardActivity[];
  generatedAt: Date;
}
