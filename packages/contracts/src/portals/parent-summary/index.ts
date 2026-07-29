export const PARENT_SUMMARY_CONTRACT_VERSION = '1.0.0' as const;

export type ParentSummaryPrincipal = {
  role: 'parent';
  adult_id: string;
  household_id: string;
  session_id: string;
};

export type ParentSummaryStudent = {
  student_id: string;
  display_name: string;
  state: 'active' | 'archived';
};

export type ParentScheduleEntry = {
  schedule_id: string;
  student_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: 'upcoming' | 'completed' | 'cancelled';
};

export type ParentAttendanceSummary = {
  attended_sessions: number;
  scheduled_sessions: number;
  attendance_percent: number | null;
  current_streak: number;
};

export type ParentBadgeSummary = {
  badge_id: string;
  label: string;
  awarded_at: string;
};

export type ParentStudentProgress = {
  student_id: string;
  attendance: ParentAttendanceSummary;
  badges: readonly ParentBadgeSummary[];
};

export type ParentUpdate = {
  update_id: string;
  kind: 'notice' | 'newsletter' | 'reminder';
  title: string;
  summary: string;
  published_at: string;
};

export type ParentSupportEntry = {
  label: 'Contact support';
  description: string;
  href: '/app/parent/support';
};

export type ParentSummaryRecord = {
  household_id: string;
  owner_adult_id: string;
  display_name: string;
  generated_at: string;
  students: readonly ParentSummaryStudent[];
  schedule: readonly ParentScheduleEntry[];
  progress: readonly ParentStudentProgress[];
  updates: readonly ParentUpdate[];
};

export type ParentSummarySnapshot = Omit<ParentSummaryRecord, 'owner_adult_id'> & {
  contract_version: typeof PARENT_SUMMARY_CONTRACT_VERSION;
  support: ParentSupportEntry;
};

export interface ParentSummaryRepository {
  loadParentSummary(household_id: string): Promise<ParentSummaryRecord | null>;
}

export const PARENT_SUMMARY_ERROR_CODES = {
  roleDenied: 'parent_summary_role_denied',
  scopeDenied: 'parent_summary_scope_denied',
  summaryMissing: 'parent_summary_missing',
  invalidRecord: 'parent_summary_invalid_record',
} as const;

export type ParentSummaryErrorCode =
  (typeof PARENT_SUMMARY_ERROR_CODES)[keyof typeof PARENT_SUMMARY_ERROR_CODES];
