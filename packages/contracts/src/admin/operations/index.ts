import type { AuthenticatedPrincipal } from '../../identity/auth/index.ts';
import type { RuntimeTier, VerificationEnvironmentId } from '../../state/index.ts';

export const ADMIN_OPERATIONS_CONTRACT_VERSION = '2.1.0' as const;
export const ADMIN_SEARCH_TRANSPORT = {
  method: 'POST',
  path: '/api/v2.1/admin/search',
  queryInUrl: false,
  analyticsAllowed: false,
} as const;
export const ADMIN_RESOLVE_TRANSPORT = {
  method: 'POST',
  path: '/api/v2.1/admin/operations/resolve',
  cache: 'no-store',
} as const;

export const ADMIN_SEARCH_KINDS = [
  'adult',
  'household',
  'student',
  'class',
  'occurrence',
  'content',
  'question',
  'ticket',
] as const;
export type AdminSearchKind = (typeof ADMIN_SEARCH_KINDS)[number];

export type AdminOperationsScope = {
  product: 'one_time_mishnayos';
  runtimeTier: RuntimeTier;
  verificationEnvironmentId: VerificationEnvironmentId;
};

export type AdminOperationsActor = AdminOperationsScope & {
  principal: AuthenticatedPrincipal;
};

export type AdminSearchRequest = {
  query: string;
  kinds: readonly AdminSearchKind[];
  pageSize: number;
  cursor: string | null;
};

export type AdminSearchDestination =
  | { route: '/app/contacts/:contactId'; targetId: string }
  | { route: '/app/households/:householdId'; targetId: string }
  | { route: '/app/students/:studentId'; targetId: string }
  | { route: '/app/classroom/classes/:classId'; targetId: string }
  | { route: '/app/classroom/occurrences/:occurrenceId'; targetId: string }
  | { route: '/app/content/:contentId'; targetId: string }
  | { route: '/app/classroom/questions'; targetId: string }
  | { route: '/app/tickets/:ticketId'; targetId: string };

export type AdminSearchResult = AdminOperationsScope & {
  source: 'persistent_store';
  kind: AdminSearchKind;
  targetId: string;
  label: string;
  distinguishingMetadata: string;
  status: string;
  matchedBy:
    'safe_id' | 'name' | 'normalized_email' | 'normalized_phone' | 'title' | 'approved_metadata';
  destination: AdminSearchDestination;
};

export type AdminSearchPage = {
  source: 'persistent_store';
  authorization: 'runtime_admin';
  queryInUrl: false;
  analyticsAllowed: false;
  results: readonly AdminSearchResult[];
  nextCursor: string | null;
};

export type AdminOccurrenceSummary = AdminOperationsScope & {
  source: 'persistent_store';
  occurrenceId: string;
  classId: string;
  title: string;
  startsAt: string;
  state: string;
  readiness: string;
  liveConsoleDestination: {
    route: '/app/live/:occurrenceId';
    targetId: string;
  };
};

export type AdminAttentionSummary = AdminOperationsScope & {
  source: 'persistent_store';
  accessOrBilling: number;
  zoomReadiness: number;
  contentFailures: number;
  unansweredQuestions: number;
  urgentTickets: number;
};

export type AdminContentPipelineSummary = AdminOperationsScope & {
  source: 'persistent_store';
  received: number;
  processing: number;
  needsReview: number;
  publishing: number;
  failed: number;
};

export type AdminPeopleLearningSummary = AdminOperationsScope & {
  source: 'persistent_store';
  activeHouseholds: number;
  activeStudents: number;
  attendanceRecorded: number;
  badgesAwarded: number;
};

export type AdminRecentActivitySummary = AdminOperationsScope & {
  source: 'persistent_store';
  windowStartedAt: string;
  windowEndedAt: string;
  communications: number;
  auditEvents: number;
  lastActivityAt: string | null;
};

export type AdminProviderHealth = AdminOperationsScope & {
  source: 'persistent_store';
  provider: string;
  state:
    'not_configured' | 'configured' | 'authenticated' | 'canary_verified' | 'live' | 'unavailable';
  observedAt: string;
  sourceEnvironment: 'fixture' | 'test' | 'staging' | 'production';
  observedRuntimeTier: RuntimeTier;
  observedVerificationEnvironmentId: VerificationEnvironmentId;
};

export const ADMIN_OPERATIONAL_VIEWS = [
  { id: 'communications', label: 'Communications', route: '/app/communications' },
  { id: 'tickets', label: 'Tickets', route: '/app/tickets' },
  { id: 'billing_access', label: 'Billing & Access', route: '/app/billing-access' },
  { id: 'integrations', label: 'Integrations', route: '/app/integrations' },
  { id: 'operations', label: 'Operations', route: '/app/operations' },
  { id: 'audit', label: 'Audit', route: '/app/audit' },
] as const;

export type AdminOperationalView = (typeof ADMIN_OPERATIONAL_VIEWS)[number];

export const ADMIN_CANONICAL_PRIMARY_NAVIGATION = [
  { id: 'dashboard', label: 'Dashboard', href: '/app/dashboard' },
  { id: 'contacts', label: 'Contacts', href: '/app/contacts' },
  { id: 'content', label: 'Content', href: '/app/content' },
  { id: 'classroom', label: 'Classroom', href: '/app/classroom' },
  { id: 'live', label: 'Live Console', href: '/app/live' },
] as const;

export const ADMIN_QUICK_ACTIONS = [
  { id: 'add_adult', label: 'Add adult', route: '/app/contacts' },
  { id: 'add_household', label: 'Add household', route: '/app/households' },
  { id: 'add_student', label: 'Add Student', route: '/app/students' },
  { id: 'create_admin', label: 'Create Admin', route: '/app/users' },
  { id: 'schedule_class', label: 'Create or schedule class', route: '/app/classroom/classes' },
  { id: 'open_next_occurrence', label: 'Open next occurrence', route: '/app/live' },
  { id: 'prepare_class', label: 'Prepare class', route: '/app/classroom/occurrences' },
  { id: 'upload_recording', label: 'Upload recording', route: '/app/content/upload' },
  { id: 'create_announcement', label: 'Create announcement', route: '/app/communications' },
  { id: 'open_tickets', label: 'Open tickets', route: '/app/tickets' },
] as const;

export type AdminOperationalAvailability =
  | { state: 'available'; observedAt: string; summary: string }
  | { state: 'unavailable'; observedAt: string; reason: 'not_reported' | 'query_unavailable' };

export type AdminOperationsStatus = AdminOperationsScope & {
  source: 'persistent_store';
  releaseSource: AdminOperationalAvailability;
  webWorkerAgreement: AdminOperationalAvailability;
  databaseMigrations: AdminOperationalAvailability;
  queueHealth: AdminOperationalAvailability & {
    depth?: number;
    oldestAgeSeconds?: number | null;
    deadLetterCount?: number;
  };
  providerDetail: AdminOperationalAvailability;
  backupRestore: AdminOperationalAvailability;
  recentRedactedFailures: AdminOperationalAvailability & {
    failureCodes?: readonly string[];
  };
};

export type AdminDashboardSnapshot = {
  source: 'persistent_store';
  authorization: 'runtime_admin';
  generatedAt: string;
  nowAndNext: readonly AdminOccurrenceSummary[];
  needsAttention: AdminAttentionSummary;
  contentPipeline: AdminContentPipelineSummary;
  peopleAndLearning: AdminPeopleLearningSummary;
  recentActivity: AdminRecentActivitySummary;
  providerHealth: readonly AdminProviderHealth[];
  operationalViews: readonly AdminOperationalView[];
  quickActions: typeof ADMIN_QUICK_ACTIONS;
  operations: AdminOperationsStatus;
};

export type AdminNavigationRequest = {
  kind: AdminSearchKind;
  targetId: string;
  selectedCredentialVersion: number;
};

export type AdminTargetAuthorization =
  | { state: 'authorized'; kind: AdminSearchKind; targetId: string }
  | { state: 'missing' | 'archived' | 'revoked' };

export type AdminNavigationResolution =
  | { state: 'open'; href: string; cache: 'no-store' }
  | { state: 'unavailable'; reason: 'missing_or_unauthorized'; cache: 'no-store' };

export interface AdminOperationsReadRepository {
  readDashboard(scope: AdminOperationsScope): Promise<AdminDashboardSnapshot>;
  search(scope: AdminOperationsScope, request: AdminSearchRequest): Promise<AdminSearchPage>;
  resolveTarget(
    scope: AdminOperationsScope,
    request: Pick<AdminNavigationRequest, 'kind' | 'targetId'>,
  ): Promise<AdminTargetAuthorization>;
}

export const ADMIN_OPERATIONS_ERROR_CODES = {
  accessDenied: 'admin_operations_access_denied',
  crossScope: 'admin_operations_cross_scope',
  invalidQuery: 'admin_operations_invalid_query',
  unsafeResult: 'admin_operations_unsafe_result',
  unavailable: 'admin_operations_unavailable',
} as const;
