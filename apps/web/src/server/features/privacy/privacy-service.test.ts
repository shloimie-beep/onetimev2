import { describe, expect, it, vi } from 'vitest';
import type {
  PrivacyActorContext,
  StudentConsentSubject,
} from '../../../../../../packages/contracts/src/privacy/index.ts';
import { authorizePrivacyRoute, createPrivacyService } from './privacy-service.ts';

const HASH = 'a'.repeat(64);
const NOW = '2026-07-28T20:00:00.000Z';

describe('privacy server boundary', () => {
  it('exposes self-managed Student routes only to the exact linked adult Student', () => {
    expect(authorizePrivacyRoute(studentActor(), 'self_student_privacy', selfSubject())).toBe(true);
    expect(
      authorizePrivacyRoute(
        { ...studentActor(), student_id: 'student-other' },
        'self_student_privacy',
        selfSubject(),
      ),
    ).toBe(false);
    expect(
      authorizePrivacyRoute({ ...studentActor(), adult_id: null }, 'self_student_data_rights', {
        ...selfSubject(),
        relationship: 'dependent',
        self_adult_id: null,
      }),
    ).toBe(false);
  });

  it('persists one consent event and returns idempotent replay without another write', async () => {
    const append = vi.fn().mockResolvedValue(true);
    const service = createPrivacyService({
      listConsentEvents: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            consent_event_id: 'consent-1',
            idempotency_key: 'idem-1',
            canonical_request_hash: HASH,
            actor_kind: 'adult_self_student',
            actor_account_or_credential_id: 'credential-1',
            actor_adult_id: 'adult-1',
            household_id: 'household-1',
            student_id: 'student-self',
            relationship: 'self',
            parent_authority_attested: false,
            scope: 'recording_participation',
            choice: 'granted',
            policy_versions: policies(),
            occurred_at: NOW,
            request_correlation_id: 'request-1',
            network_evidence_digest: HASH,
            supersedes_consent_event_id: null,
            reason_code: 'policy_accepted',
          },
        ]),
      appendConsentEvent: append,
      createDataRightsRequest: vi.fn(),
    });
    const input = {
      consent_event_id: 'consent-1',
      idempotency_key: 'idem-1',
      canonical_request_hash: HASH,
      actor: studentActor(),
      subject: selfSubject(),
      scope: 'recording_participation' as const,
      choice: 'granted' as const,
      policy_versions: policies(),
      occurred_at: NOW,
      request_correlation_id: 'request-1',
      network_evidence_digest: HASH,
      reason_code: 'policy_accepted',
    };
    expect((await service.recordConsent(input)).disposition).toBe('appended');
    expect((await service.recordConsent(input)).disposition).toBe('replayed');
    expect(append).toHaveBeenCalledOnce();
  });
});

function studentActor(): PrivacyActorContext {
  return {
    role: 'student',
    account_or_credential_id: 'credential-1',
    adult_id: 'adult-1',
    student_id: 'student-self',
    household_id: 'household-1',
    recent_password_verified: true,
    session_id: 'session-1',
  };
}

function selfSubject(): StudentConsentSubject {
  return {
    student_id: 'student-self',
    household_id: 'household-1',
    relationship: 'self',
    owner_adult_id: 'adult-1',
    self_adult_id: 'adult-1',
  };
}

function policies() {
  return {
    privacy_notice: 'privacy-v1',
    terms: 'terms-v1',
    student_data_recording: 'recording-v1',
    cancellation_refund: null,
  };
}
