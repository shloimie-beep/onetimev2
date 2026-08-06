import { describe, expect, it } from 'vitest';
import type {
  ConsentEvent,
  DataRightsRequest,
  PrivacyActorContext,
  PrivacyPolicyVersions,
  StudentConsentSubject,
} from '../../../contracts/src/privacy/index.ts';
import {
  appendConsentEvent,
  assertPurgeLedgerDurable,
  assertSharedMediaReplacementReady,
  createDataRightsRequest,
  createDeletionPurgeRecord,
  decideProtectedPlayback,
  decideRecordedClassJoin,
  evaluateRestoreTrafficGate,
  freezeRecordingParticipantSnapshot,
  issueExportDownloadGrant,
  memberRecognitionProjection,
  parentExportCategories,
  planSharedMediaPrivacyTreatment,
  redeemExportDownloadGrant,
  studentExportCategories,
  transitionDataRightsRequest,
  verifyPurgeLedgerChain,
  visiblePrivacyStatus,
} from './index.ts';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const HASH_D = 'd'.repeat(64);
const NOW = new Date('2026-07-28T20:00:00.000Z');
const POLICIES: PrivacyPolicyVersions = {
  privacy_notice: 'privacy-v1',
  terms: 'terms-v1',
  student_data_recording: 'recording-v1',
  cancellation_refund: null,
};
const DEPENDENT: StudentConsentSubject = {
  student_id: 'student-dependent',
  household_id: 'household-1',
  relationship: 'dependent',
  owner_adult_id: 'adult-1',
  self_adult_id: null,
};
const SELF: StudentConsentSubject = {
  student_id: 'student-self',
  household_id: 'household-1',
  relationship: 'self',
  owner_adult_id: 'adult-1',
  self_adult_id: 'adult-1',
};

describe('Student-scoped consent and recording snapshots', () => {
  it('allows only the account owner to consent for an exact dependent Student', () => {
    expect(() =>
      consent([], DEPENDENT, studentActor('student-dependent'), 'recording_participation'),
    ).toThrow(/relationship-authorized adult/i);
    const accepted = consent([], DEPENDENT, parentActor(), 'recording_participation');
    expect(accepted.event.actor_kind).toBe('parent_account_owner');
    expect(accepted.event.parent_authority_attested).toBe(true);
    expect(accepted.event.student_id).toBe(DEPENDENT.student_id);
  });

  it('denies Parent proxy recording consent for self and accepts only the linked adult Student', () => {
    expect(() => consent([], SELF, parentActor(), 'recording_participation')).toThrow(
      /relationship-authorized adult/i,
    );
    expect(
      consent([], SELF, studentActor(SELF.student_id), 'recording_participation').event.actor_kind,
    ).toBe('adult_self_student');
  });

  it('requires current service and recording consent for join but not protected playback', () => {
    const events = grantedJoinEvents(DEPENDENT, parentActor());
    expect(
      decideRecordedClassJoin({
        subject: DEPENDENT,
        events,
        current_policy_versions: POLICIES,
      }),
    ).toEqual({ allowed: true, safe_code: 'current_consent' });
    const withdrawal = consent(
      events,
      DEPENDENT,
      parentActor(),
      'recording_participation',
      'withdrawn',
    ).event;
    expect(
      decideRecordedClassJoin({
        subject: DEPENDENT,
        events: [...events, withdrawal],
        current_policy_versions: POLICIES,
      }).allowed,
    ).toBe(false);
    expect(decideProtectedPlayback(true)).toEqual({
      allowed: true,
      safe_code: 'playback_derived_independently',
    });
  });

  it('freezes immutable participant evidence that later consent cannot rewrite', () => {
    const events = grantedJoinEvents(DEPENDENT, parentActor());
    const snapshot = freezeRecordingParticipantSnapshot({
      snapshot_id: 'snapshot-1',
      occurrence_id: 'occurrence-1',
      subject: DEPENDENT,
      events,
      current_policy_versions: POLICIES,
      capture_intervals: [{ started_at: NOW.toISOString(), ended_at: null }],
      notice_confirmed: true,
      student_lifecycle_version: 2,
      enrollment_version: 3,
      access_version: 4,
      session_version: 5,
      created_at: NOW.toISOString(),
      audit_ref: 'audit-snapshot',
    });
    const originalRecordingEvent = snapshot.recording_consent_event_id;
    consent(events, DEPENDENT, parentActor(), 'recording_participation', 'withdrawn');
    expect(snapshot.recording_consent_event_id).toBe(originalRecordingEvent);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.capture_intervals)).toBe(true);
  });

  it('replays double-submit and rejects changed meaning for one idempotency key', () => {
    const first = consent([], DEPENDENT, parentActor(), 'service_account');
    const replay = appendConsentEvent(
      [first.event],
      mutation(DEPENDENT, parentActor(), 'service_account'),
    );
    expect(replay).toEqual({ disposition: 'replayed', event: first.event });
    expect(() =>
      appendConsentEvent([first.event], {
        ...mutation(DEPENDENT, parentActor(), 'service_account'),
        canonical_request_hash: HASH_D,
      }),
    ).toThrow(/cannot be reused/i);
  });
});

describe('data-rights actor scope and request lifecycle', () => {
  it('accepts exact isolated-staging and production scope and rejects invalid bindings', () => {
    const isolated = createDataRightsRequest(rightsInput(parentActor()));
    expect({
      product: isolated.product,
      runtime_tier: isolated.runtime_tier,
      verification_environment_id: isolated.verification_environment_id,
    }).toEqual({
      product: 'one_time_mishnayos',
      runtime_tier: 'isolated_staging',
      verification_environment_id: 'ci',
    });

    const production = createDataRightsRequest({
      ...rightsInput(parentActor()),
      scope: {
        product: 'one_time_mishnayos',
        runtime_tier: 'production',
        verification_environment_id: 'production_operator_canary',
      },
    });
    expect(production.runtime_tier).toBe('production');

    expect(() =>
      createDataRightsRequest({
        ...rightsInput(parentActor()),
        scope: {
          product: 'one_time_mishnayos',
          runtime_tier: 'production',
          verification_environment_id: 'ci',
        },
      }),
    ).toThrow(/exact product, runtime tier, and environment binding/i);
  });

  it('denies dependent self-service and cross-household requests', () => {
    expect(() =>
      createDataRightsRequest({
        ...rightsInput(studentActor(DEPENDENT.student_id)),
        subject: {
          kind: 'student',
          student_id: DEPENDENT.student_id,
          household_id: DEPENDENT.household_id,
          relationship: 'dependent',
          self_adult_id: null,
        },
      }),
    ).toThrow(/not authorized/i);
    expect(() =>
      createDataRightsRequest({
        ...rightsInput(parentActor()),
        subject: { kind: 'household', household_id: 'household-other' },
      }),
    ).toThrow(/not authorized/i);
    expect(() =>
      createDataRightsRequest({
        ...rightsInput(parentActor()),
        subject: {
          kind: 'student',
          student_id: SELF.student_id,
          household_id: SELF.household_id,
          relationship: 'self',
          self_adult_id: SELF.self_adult_id,
        },
      }),
    ).toThrow(/not authorized/i);
  });

  it('requires recent password and separate Admin review for a dependent request', () => {
    expect(() =>
      createDataRightsRequest({
        ...rightsInput({ ...parentActor(), recent_password_verified: false }),
        subject: dependentSubject(),
      }),
    ).toThrow(/recent password/i);
    let request = createDataRightsRequest({
      ...rightsInput(parentActor()),
      subject: dependentSubject(),
    });
    request = transition(request, 'identity_verified', 'worker');
    expect(() => transition(request, 'approved', 'privacy_admin')).toThrow(
      /separate privacy Admin review/i,
    );
    request = transitionDataRightsRequest(request, {
      expected_version: request.version,
      to_state: 'approved',
      actor_kind: 'privacy_admin',
      now: NOW,
      audit_ref: 'audit-approved',
      dependent_review_completed: true,
    });
    expect(request.dependent_review_completed).toBe(true);
  });

  it('exposes only the exact five statuses and never converts uncertain provider work to failure', () => {
    expect(visiblePrivacyStatus('received', [])).toBe('requested');
    expect(visiblePrivacyStatus('executing', [])).toBe('processing');
    expect(visiblePrivacyStatus('provider_pending', [])).toBe('partially_excepted');
    expect(visiblePrivacyStatus('completed', [])).toBe('completed');
    expect(visiblePrivacyStatus('completed', ['legal_hold'])).toBe('partially_excepted');
    expect(visiblePrivacyStatus('failed', [])).toBe('failed');
    expect(visiblePrivacyStatus('canceled', [])).toBeNull();

    let request = requestAt('provider_pending');
    request = {
      ...request,
      provider_cascades: [
        {
          provider: 'vimeo',
          state: 'pending',
          reconciliation_digest: null,
          safe_exception_code: null,
          unknown_effect: true,
        },
      ],
    };
    expect(() =>
      transitionDataRightsRequest(request, {
        expected_version: request.version,
        to_state: 'failed',
        actor_kind: 'reconciler',
        now: NOW,
        audit_ref: 'audit-failed',
        terminal_reason_code: 'provider_terminal',
        canonical_noncompletion_proven: true,
      }),
    ).toThrow(/no unknown effect/i);
  });

  it('keeps closure distinct from erasure', () => {
    const closure = createDataRightsRequest({
      ...rightsInput(parentActor()),
      kind: 'closure',
      subject: { kind: 'household', household_id: 'household-1' },
    });
    const erasure = createDataRightsRequest({
      ...rightsInput(parentActor()),
      request_id: 'request-erasure',
      kind: 'erasure',
      subject: { kind: 'household', household_id: 'household-1' },
    });
    expect(closure.kind).toBe('closure');
    expect(erasure.kind).toBe('erasure');
    expect(closure.request_id).not.toBe(erasure.request_id);
  });

  it('issues an initiating-session-bound one-time download that expires exactly at 15 minutes', () => {
    const completed = { ...requestAt('completed'), kind: 'export' as const };
    const grant = issueExportDownloadGrant({
      request: completed,
      grant_id: 'grant-1',
      token_hash: HASH_A,
      subject_binding_hash: HASH_B,
      initiating_session_id: 'session-parent',
      now: NOW,
    });
    expect(new Date(grant.expires_at).getTime() - NOW.getTime()).toBe(15 * 60 * 1000);
    expect({
      product: grant.product,
      runtime_tier: grant.runtime_tier,
      verification_environment_id: grant.verification_environment_id,
    }).toEqual({
      product: completed.product,
      runtime_tier: completed.runtime_tier,
      verification_environment_id: completed.verification_environment_id,
    });
    const used = redeemExportDownloadGrant(grant, {
      expected_version: 1,
      token_hash: HASH_A,
      subject_binding_hash: HASH_B,
      session_id: 'session-parent',
      now: new Date(NOW.getTime() + 1),
    });
    expect(used.used_at).not.toBeNull();
    expect(() =>
      redeemExportDownloadGrant(used, {
        expected_version: 2,
        token_hash: HASH_A,
        subject_binding_hash: HASH_B,
        session_id: 'session-parent',
        now: new Date(NOW.getTime() + 2),
      }),
    ).toThrow(/reused/i);
    expect(() =>
      redeemExportDownloadGrant(grant, {
        expected_version: 1,
        token_hash: HASH_A,
        subject_binding_hash: HASH_B,
        session_id: 'session-parent',
        now: new Date(NOW.getTime() + 15 * 60 * 1000),
      }),
    ).toThrow(/expired/i);
  });

  it('ordinary Parent export excludes private Student bodies and shared recordings', () => {
    expect(parentExportCategories().excluded).toEqual(
      expect.arrayContaining(['private_questions', 'rabbi_answers', 'student_support_bodies']),
    );
  });

  it('self-managed adult Student export includes only own learning records', () => {
    const disclosure = studentExportCategories();
    expect(disclosure.included).toEqual(
      expect.arrayContaining([
        'own_student_profile',
        'own_private_questions_rabbi_answers',
        'own_student_support',
      ]),
    );
    expect(disclosure.excluded).toEqual(
      expect.arrayContaining([
        'sibling_data',
        'other_participant_data',
        'shared_raw_recordings',
        'provider_secrets',
        'other_participant_leaderboard_details',
      ]),
    );
  });
});

describe('shared-media redaction and independent purge evidence', () => {
  it('preserves other participants and requires every derivative plus human/readback proof', () => {
    const plan = planSharedMediaPrivacyTreatment({
      student_id: 'student-dependent',
      participants: [
        {
          content_version_id: 'content-v1',
          student_id: 'student-dependent',
          other_participant_count: 2,
          required_actions: ['mute', 'transcript_redaction', 'worksheet_redaction'],
          redaction_state: 'in_progress',
        },
      ],
    });
    expect(plan).toMatchObject({
      restrict_immediately: true,
      delete_other_students: false,
      replacement_required: true,
    });
    expect(() =>
      assertSharedMediaReplacementReady({
        plan,
        human_admin_approved: true,
        provider_readback_verified: true,
        transcript_redacted: true,
        captions_redacted: true,
        worksheet_redacted: false,
        search_index_rebuilt: true,
      }),
    ).toThrow(/every derivative/i);
  });

  it('withdraws recognition without changing rank or learning facts', () => {
    const projection = memberRecognitionProjection({
      consent_granted: false,
      viewer_is_subject: false,
      consented_safe_name: null,
      class_scoped_alias: 'Anonymous Student \u2022 A7',
      underlying_rank: 3,
      learning_fact_count: 19,
    });
    expect(projection).toEqual({
      display_label: 'Anonymous Student \u2022 A7',
      rank: 3,
      learning_fact_count: 19,
      named_attribution_cache_valid: false,
    });
  });

  it('chains hash-only purge records and blocks deletion until both immutable copies verify', () => {
    const approved = { ...requestAt('approved'), kind: 'erasure' as const };
    const first = purgeRecord(approved, 1, null);
    const second = purgeRecord(approved, 2, first.record_digest);
    expect(verifyPurgeLedgerChain([first, second])).toBe(true);
    expect(() =>
      assertPurgeLedgerDurable(first, {
        record_digest: first.record_digest,
        primary_object_version_hash: HASH_A,
        replica_object_version_hash: HASH_B,
        primary_checksum_verified: true,
        replica_checksum_verified: false,
        object_lock_compliance_verified: true,
        replication_completed_at: NOW.toISOString(),
      }),
    ).toThrow(/replicated purge evidence/i);
    expect(() =>
      assertPurgeLedgerDurable(first, {
        record_digest: first.record_digest,
        primary_object_version_hash: HASH_A,
        replica_object_version_hash: HASH_B,
        primary_checksum_verified: true,
        replica_checksum_verified: true,
        object_lock_compliance_verified: true,
        replication_completed_at: NOW.toISOString(),
      }),
    ).not.toThrow();
  });

  it('keeps restored traffic closed until every tombstone and negative proof succeeds', () => {
    expect(
      evaluateRestoreTrafficGate({
        ledger_chain_valid: true,
        applicable_record_count: 2,
        replayed_record_count: 1,
        negative_queries_passed: true,
        provider_effects_disabled: true,
        pending_provider_recreation_count: 0,
      }).traffic_allowed,
    ).toBe(false);
    expect(
      evaluateRestoreTrafficGate({
        ledger_chain_valid: true,
        applicable_record_count: 2,
        replayed_record_count: 2,
        negative_queries_passed: true,
        provider_effects_disabled: true,
        pending_provider_recreation_count: 0,
      }).traffic_allowed,
    ).toBe(true);
  });
});

function consent(
  existing: readonly ConsentEvent[],
  subject: StudentConsentSubject,
  actor: PrivacyActorContext,
  scope: 'service_account' | 'recording_participation' | 'member_recognition',
  choice: 'granted' | 'declined' | 'withdrawn' = 'granted',
) {
  return appendConsentEvent(existing, mutation(subject, actor, scope, choice));
}

function mutation(
  subject: StudentConsentSubject,
  actor: PrivacyActorContext,
  scope: 'service_account' | 'recording_participation' | 'member_recognition',
  choice: 'granted' | 'declined' | 'withdrawn' = 'granted',
) {
  return {
    consent_event_id: `consent-${scope}-${choice}`,
    idempotency_key: `idem-${subject.student_id}-${scope}-${choice}`,
    canonical_request_hash: choice === 'withdrawn' ? HASH_C : HASH_A,
    actor,
    subject,
    scope,
    choice,
    policy_versions: POLICIES,
    occurred_at:
      choice === 'withdrawn' ? new Date(NOW.getTime() + 1_000).toISOString() : NOW.toISOString(),
    request_correlation_id: `request-${scope}-${choice}`,
    network_evidence_digest: HASH_B,
    reason_code: choice === 'withdrawn' ? 'future_consent_withdrawn' : 'policy_accepted',
  } as const;
}

function grantedJoinEvents(
  subject: StudentConsentSubject,
  actor: PrivacyActorContext,
): ConsentEvent[] {
  const serviceActor = subject.relationship === 'self' ? parentActor() : actor;
  const service = consent([], subject, serviceActor, 'service_account').event;
  const recording = consent([service], subject, actor, 'recording_participation').event;
  return [service, recording];
}

function parentActor(): PrivacyActorContext {
  return {
    role: 'parent',
    account_or_credential_id: 'account-parent',
    adult_id: 'adult-1',
    student_id: null,
    household_id: 'household-1',
    recent_password_verified: true,
    session_id: 'session-parent',
  };
}

function studentActor(studentId: string): PrivacyActorContext {
  return {
    role: 'student',
    account_or_credential_id: 'credential-student',
    adult_id: studentId === SELF.student_id ? 'adult-1' : null,
    student_id: studentId,
    household_id: 'household-1',
    recent_password_verified: true,
    session_id: 'session-student',
  };
}

function rightsInput(actor: PrivacyActorContext) {
  return {
    scope: {
      product: 'one_time_mishnayos' as const,
      runtime_tier: 'isolated_staging' as const,
      verification_environment_id: 'ci' as const,
    },
    request_id: 'request-1',
    kind: 'export' as const,
    subject: { kind: 'household' as const, household_id: 'household-1' },
    actor,
    owner_adult_id: 'adult-1',
    requested_categories: ['profile', 'consent'],
    now: NOW,
    audit_ref: 'audit-request',
  };
}

function dependentSubject() {
  return {
    kind: 'student' as const,
    student_id: DEPENDENT.student_id,
    household_id: DEPENDENT.household_id,
    relationship: 'dependent' as const,
    self_adult_id: null,
  };
}

function transition(
  request: DataRightsRequest,
  toState: DataRightsRequest['state'],
  actorKind: 'requester' | 'privacy_admin' | 'worker' | 'reconciler',
): DataRightsRequest {
  return transitionDataRightsRequest(request, {
    expected_version: request.version,
    to_state: toState,
    actor_kind: actorKind,
    now: NOW,
    audit_ref: `audit-${toState}`,
  });
}

function requestAt(state: DataRightsRequest['state']): DataRightsRequest {
  return {
    ...createDataRightsRequest(rightsInput(parentActor())),
    state,
    visible_status: visiblePrivacyStatus(state, []),
    version: 4,
  };
}

function purgeRecord(
  approved: DataRightsRequest,
  sequence: number,
  previousRecordDigest: string | null,
) {
  return createDeletionPurgeRecord({
    approved_request: approved,
    ledger_event_id: `ledger-${sequence}`,
    request_audit_digest: HASH_A,
    policy_version_hash: HASH_B,
    identifiers: [{ scope: 'student', hmac_sha256: HASH_C, hmac_key_version: 'purge-key-v1' }],
    dispositions: ['delete', 'block_recreation'],
    category_tombstones: ['student_profile'],
    provider_tombstones: ['zoom_registrant'],
    occurred_at: NOW.toISOString(),
    effective_at: NOW.toISOString(),
    replay_until: new Date(NOW.getTime() + 35 * 24 * 60 * 60 * 1000).toISOString(),
    legal_hold_codes: [],
    scope: {
      product: 'one_time_mishnayos',
      runtime_tier: 'isolated_staging',
      verification_environment_id: 'ci',
    },
    release_digest: HASH_C,
    configuration_digest: HASH_D,
    sequence,
    previous_record_digest: previousRecordDigest,
  });
}
