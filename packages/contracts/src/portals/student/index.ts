export const STUDENT_PORTAL_CONTRACT_VERSION = '2.1.0' as const;

export type StudentRelationship = 'self' | 'dependent';
export type StudentAccessState = 'free' | 'active' | 'grace' | 'inactive';
export type StudentLifecycleState = 'active' | 'archived';

export type StudentPortalPrincipal = {
  role: 'student';
  humanAccountId: string;
  sessionId: string;
  householdId: string;
  studentId: string;
  credentialVersion: number;
  relationship: StudentRelationship;
  selfAdultOwnerVerified: boolean;
  accessState: StudentAccessState;
  studentState: StudentLifecycleState;
  preferredTimeZone: string;
};

export type StudentSelfRecord = {
  studentId: string;
  householdId: string;
  actualName: string;
  displayName: string | null;
  username: string;
  relationship: StudentRelationship;
  state: StudentLifecycleState;
  version: number;
};

export type StudentJoinSummary =
  | { state: 'outside_window' | 'preparing' | 'cancelled' | 'ended' }
  | {
      state: 'join' | 'reconnect';
      occurrenceId: string;
      action: 'open_student_class';
    }
  | { state: 'second_device_denied'; resetBy: 'parent_or_admin' };

export type StudentTodaySnapshot = {
  nextClassLabel: string | null;
  nextClassTimeLabel: string | null;
  join: StudentJoinSummary | null;
  latestLessonTitle: string | null;
  latestLessonContentId: string | null;
  questionStatus: 'none' | 'submitted' | 'answered';
  unreadNoticeCount: number;
  nextBadgeLabel: string | null;
  nextBadgeProgressPercent: number | null;
};

export type StudentSelfProfile = {
  studentId: string;
  actualName: string;
  displayName: string;
  username: string;
  relationship: StudentRelationship;
};

export type StudentAccountControls = {
  username: string;
  credentialManagedBy: 'parent_or_admin';
  canChangePassword: false;
  canViewCurrentPassword: false;
  credentialHelp: string;
  canLogout: true;
};

export type StudentPortalBootstrap = {
  contractVersion: typeof STUDENT_PORTAL_CONTRACT_VERSION;
  profile: StudentSelfProfile;
  today: StudentTodaySnapshot;
  account: StudentAccountControls;
  navigation: readonly StudentNavigationItem[];
  preferredTimeZone: string;
};

export type StudentNavigationItem = {
  id:
    | 'today'
    | 'calendar'
    | 'library'
    | 'progress'
    | 'questions'
    | 'updates'
    | 'notifications'
    | 'support'
    | 'account'
    | 'privacy'
    | 'data-rights';
  label: string;
  href: string;
  placement: 'primary' | 'utility';
};

export const STUDENT_CANONICAL_ROUTES = {
  today: '/app/student',
  calendar: '/app/student/calendar',
  occurrence: '/app/student/classes/:occurrenceId',
  classroom: '/app/student/class/:occurrenceId',
  library: '/app/student/library',
  content: '/app/student/library/:contentId',
  progress: '/app/student/progress',
  questions: '/app/student/questions',
  newQuestion: '/app/student/questions/new',
  question: '/app/student/questions/:questionId',
  updates: '/app/student/updates',
  notifications: '/app/student/notifications',
  support: '/app/student/support',
  supportRequest: '/app/student/support/:ticketId',
  account: '/app/student/account',
  privacy: '/app/student/privacy',
  dataRights: '/app/student/data-rights',
} as const;

export interface StudentSelfRepository {
  loadSelf(input: { studentId: string; householdId: string }): Promise<{
    profile: StudentSelfRecord;
    today: StudentTodaySnapshot;
  } | null>;
}

export interface StudentSessionRevocationPort {
  revokeStudentSession(input: {
    sessionId: string;
    studentId: string;
    reason: 'student_logout';
  }): Promise<void>;
}

export const STUDENT_PORTAL_ERROR_CODES = {
  accessInactive: 'student_access_inactive',
  scopeDenied: 'student_scope_denied',
  archived: 'student_archived',
  routeDenied: 'student_route_denied',
  selfRecordMissing: 'student_self_record_missing',
} as const;
