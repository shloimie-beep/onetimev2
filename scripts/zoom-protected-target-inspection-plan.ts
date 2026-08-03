import type {
  ZoomProtectedTargetScopeInspection,
  ZoomServerToServerCredentials,
} from '../packages/domain/src/providers/zoom-rest.ts';

export const ZOOM_PROTECTED_TARGET_INSPECTION_AUTHORIZATION = 'INSPECT_PROTECTED_CLASS_TARGET_ONCE';
export const PROTECTED_CLASS_TARGET_ROTATION_BLOCKED = 'PROTECTED_CLASS_TARGET_ROTATION_BLOCKED';

export type ZoomProtectedTargetInspectionPlan = {
  credentials: ZoomServerToServerCredentials;
  meetingId: string;
  expectedHostUserId: string;
  canonicalS2sAccountUsed: boolean;
  legacyS2sAccountAliasUsed: boolean;
};

export type ZoomProtectedTargetInspectionPlanObserver = Readonly<{
  onProtectedTargetSourceScopeChecked?: (() => void) | undefined;
  onProtectedTargetSourceScopeAllowed?: (() => void) | undefined;
  onPreflightGatesPassed?: (() => void) | undefined;
  onProtectedTargetParsed?: (() => void) | undefined;
}>;

export type ZoomProtectedTargetInspectionRequestCounts = {
  oauthTokenRequests: 0 | 1;
  meetingResourceGetRequests: 0 | 1;
};

type InspectionClassifications = ZoomProtectedTargetScopeInspection & {
  preflight_gates_passed: boolean;
  protected_target_parsed: boolean;
  protected_target_source_scope_checked: boolean;
  protected_target_source_scope_allowed: boolean;
  canonical_s2s_account_used: boolean;
  legacy_s2s_account_alias_used: boolean;
  provider_readback_succeeded: boolean;
  resource_requests_get_only: boolean;
};

export type ZoomProtectedTargetInspectionResult = {
  status: 'SAFE_TO_REVOKE' | 'BLOCKED';
  blocker: null | typeof PROTECTED_CLASS_TARGET_ROTATION_BLOCKED;
  classifications: InspectionClassifications;
  counts: {
    oauth_token_requests: 0 | 1;
    meeting_resource_get_requests: 0 | 1;
    resource_mutation_requests: 0;
  };
};

const emptyScopeInspection: ZoomProtectedTargetScopeInspection = {
  type_is_single_meeting: false,
  host_matches_expected: false,
  topic_matches_repository_canary: false,
  agenda_matches_repository_canary: false,
  registrant_confirmation_email_disabled: false,
  registrant_email_notification_disabled: false,
  join_before_host_disabled: false,
  safe_to_revoke: false,
};

export function buildZoomProtectedTargetInspectionPlan(
  source: NodeJS.ProcessEnv,
  observer: ZoomProtectedTargetInspectionPlanObserver = {},
): ZoomProtectedTargetInspectionPlan {
  assertExactGate(
    source.ONE_TIME_RUNTIME_ENVIRONMENT === 'isolated_staging',
    'ONE_TIME_RUNTIME_ENVIRONMENT',
  );
  assertExactGate(source.ZOOM_CLASSROOM_PROVIDER_MODE === 'sink', 'ZOOM_CLASSROOM_PROVIDER_MODE');
  assertExactGate(
    source.ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED === 'false',
    'ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED',
  );
  assertExactGate(
    source.ZOOM_CLASSROOM_CANARY_ENABLED === 'false',
    'ZOOM_CLASSROOM_CANARY_ENABLED',
  );
  assertExactGate(
    source.ZOOM_PROTECTED_TARGET_INSPECTION_AUTHORIZATION ===
      ZOOM_PROTECTED_TARGET_INSPECTION_AUTHORIZATION,
    'ZOOM_PROTECTED_TARGET_INSPECTION_AUTHORIZATION',
  );

  const protectedTarget = source.ONE_TIME_PROTECTED_CLASS_TARGET_URL?.trim();
  const tishaEventTarget = source.ONE_TIME_TISHA_BAV_2026_ZOOM_JOIN_URL?.trim();

  assertExactGate(Boolean(protectedTarget), 'ONE_TIME_PROTECTED_CLASS_TARGET_URL');
  assertExactGate(Boolean(tishaEventTarget), 'ONE_TIME_TISHA_BAV_2026_ZOOM_JOIN_URL');
  const meetingId = meetingIdFromProtectedZoomUrl(protectedTarget as string);
  observer.onProtectedTargetParsed?.();
  const tishaEventMeetingId = meetingIdFromProtectedZoomUrl(tishaEventTarget as string);
  observer.onProtectedTargetSourceScopeChecked?.();
  assertExactGate(tishaEventMeetingId !== meetingId, 'PROTECTED_TARGET_SOURCE_SCOPE');
  observer.onProtectedTargetSourceScopeAllowed?.();

  const canonicalAccountId = source.ZOOM_S2S_ACCOUNT_ID?.trim();
  const legacyAccountId = source.ZOOM_ACCOUNT_ID?.trim();
  const accountId = canonicalAccountId || legacyAccountId;
  const clientId = source.ZOOM_S2S_CLIENT_ID?.trim();
  const clientSecret = source.ZOOM_S2S_CLIENT_SECRET?.trim();
  const expectedHostUserId = source.ZOOM_HOST_USER_ID?.trim();

  assertExactGate(Boolean(accountId), 'ZOOM_S2S_ACCOUNT_ID');
  assertExactGate(Boolean(clientId), 'ZOOM_S2S_CLIENT_ID');
  assertExactGate(Boolean(clientSecret), 'ZOOM_S2S_CLIENT_SECRET');
  assertExactGate(Boolean(expectedHostUserId), 'ZOOM_HOST_USER_ID');
  observer.onPreflightGatesPassed?.();

  return {
    credentials: {
      accountId: accountId as string,
      clientId: clientId as string,
      clientSecret: clientSecret as string,
    },
    meetingId,
    expectedHostUserId: expectedHostUserId as string,
    canonicalS2sAccountUsed: Boolean(canonicalAccountId),
    legacyS2sAccountAliasUsed: !canonicalAccountId && Boolean(legacyAccountId),
  };
}

export function buildZoomProtectedTargetInspectionResult(input: {
  inspection: ZoomProtectedTargetScopeInspection;
  canonicalS2sAccountUsed: boolean;
  legacyS2sAccountAliasUsed: boolean;
  requestCounts: ZoomProtectedTargetInspectionRequestCounts;
}): ZoomProtectedTargetInspectionResult {
  const safeToRevoke =
    input.inspection.type_is_single_meeting &&
    input.inspection.host_matches_expected &&
    input.inspection.topic_matches_repository_canary &&
    input.inspection.agenda_matches_repository_canary &&
    input.inspection.registrant_confirmation_email_disabled &&
    input.inspection.registrant_email_notification_disabled &&
    input.inspection.join_before_host_disabled &&
    input.inspection.safe_to_revoke;
  return {
    status: safeToRevoke ? 'SAFE_TO_REVOKE' : 'BLOCKED',
    blocker: safeToRevoke ? null : PROTECTED_CLASS_TARGET_ROTATION_BLOCKED,
    classifications: {
      ...input.inspection,
      safe_to_revoke: safeToRevoke,
      preflight_gates_passed: true,
      protected_target_parsed: true,
      protected_target_source_scope_checked: true,
      protected_target_source_scope_allowed: true,
      canonical_s2s_account_used: input.canonicalS2sAccountUsed,
      legacy_s2s_account_alias_used: input.legacyS2sAccountAliasUsed,
      provider_readback_succeeded: true,
      resource_requests_get_only: true,
    },
    counts: {
      oauth_token_requests: input.requestCounts.oauthTokenRequests,
      meeting_resource_get_requests: input.requestCounts.meetingResourceGetRequests,
      resource_mutation_requests: 0,
    },
  };
}

export function buildZoomProtectedTargetInspectionBlockedResult(input: {
  preflightGatesPassed: boolean;
  protectedTargetParsed: boolean;
  protectedTargetSourceScopeChecked: boolean;
  protectedTargetSourceScopeAllowed: boolean;
  canonicalS2sAccountUsed?: boolean | undefined;
  legacyS2sAccountAliasUsed?: boolean | undefined;
  requestCounts: ZoomProtectedTargetInspectionRequestCounts;
}): ZoomProtectedTargetInspectionResult {
  return {
    status: 'BLOCKED',
    blocker: PROTECTED_CLASS_TARGET_ROTATION_BLOCKED,
    classifications: {
      ...emptyScopeInspection,
      preflight_gates_passed: input.preflightGatesPassed,
      protected_target_parsed: input.protectedTargetParsed,
      protected_target_source_scope_checked: input.protectedTargetSourceScopeChecked,
      protected_target_source_scope_allowed: input.protectedTargetSourceScopeAllowed,
      canonical_s2s_account_used: input.canonicalS2sAccountUsed ?? false,
      legacy_s2s_account_alias_used: input.legacyS2sAccountAliasUsed ?? false,
      provider_readback_succeeded: false,
      resource_requests_get_only: true,
    },
    counts: {
      oauth_token_requests: input.requestCounts.oauthTokenRequests,
      meeting_resource_get_requests: input.requestCounts.meetingResourceGetRequests,
      resource_mutation_requests: 0,
    },
  };
}

export function meetingIdFromProtectedZoomUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('ZOOM_PROTECTED_TARGET_INSPECTION_PREFLIGHT_FAILED:PROTECTED_TARGET_URL');
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.split('/').filter(Boolean);
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    (host !== 'zoom.us' && !host.endsWith('.zoom.us')) ||
    path.length !== 2 ||
    !['j', 'w'].includes(path[0] ?? '') ||
    !/^\d{9,11}$/.test(path[1] ?? '')
  ) {
    throw new Error('ZOOM_PROTECTED_TARGET_INSPECTION_PREFLIGHT_FAILED:PROTECTED_TARGET_URL');
  }
  return path[1] as string;
}

function assertExactGate(condition: boolean, gate: string): asserts condition {
  if (!condition) {
    throw new Error(`ZOOM_PROTECTED_TARGET_INSPECTION_PREFLIGHT_FAILED:${gate}`);
  }
}
