import { describe, expect, it, vi } from 'vitest';
import type {
  DataRightsRequest,
  RetentionWorkItem,
} from '../../../../../packages/contracts/src/privacy/index.ts';
import { runPrivacyRetentionPlanningBatch } from './runner.ts';

const HASH = 'a'.repeat(64);
const NOW = new Date('2026-07-28T20:00:00.000Z');

describe('privacy retention planning runner', () => {
  it('plans without dispatching provider effects and fences stale persistence', async () => {
    const persistPlan = vi.fn().mockResolvedValue(false);
    const summary = await runPrivacyRetentionPlanningBatch({
      repository: {
        claimDue: vi.fn().mockResolvedValue([work()]),
        persistPlan,
      },
      planner: {
        loadApprovedErasure: vi.fn().mockResolvedValue(approvedRequest()),
        purgeRecordInput: vi.fn().mockReturnValue({
          ledger_event_id: 'ledger-1',
          request_audit_digest: HASH,
          policy_version_hash: HASH,
          identifiers: [{ scope: 'student', hmac_sha256: HASH, hmac_key_version: 'purge-key-v1' }],
          dispositions: ['delete'],
          category_tombstones: ['student_profile'],
          provider_tombstones: [],
          occurred_at: NOW.toISOString(),
          effective_at: NOW.toISOString(),
          replay_until: new Date(NOW.getTime() + 1_000).toISOString(),
          legal_hold_codes: [],
          scope: {
            product: 'one_time_mishnayos',
            runtime_tier: 'isolated_staging',
            verification_environment_id: 'ci',
          },
          release_digest: HASH,
          configuration_digest: HASH,
          sequence: 1,
          previous_record_digest: null,
        }),
      },
      scope: {
        product: 'one_time_mishnayos',
        runtime_tier: 'isolated_staging',
        verification_environment_id: 'ci',
      },
      now: NOW,
      limit: 5,
    });
    expect(summary).toEqual({
      claimed: 1,
      planned: 0,
      stale_fenced: 1,
      failed_closed: 0,
    });
    expect(persistPlan).toHaveBeenCalledOnce();
    expect(work().provider_outbox_intents).toHaveLength(0);
  });
});

function work(): RetentionWorkItem {
  return {
    work_id: 'work-1',
    request_id: 'request-1',
    subject_binding_hash: HASH,
    category: 'student_profile',
    due_at: NOW.toISOString(),
    legal_hold_codes: [],
    provider_outbox_intents: [],
    state: 'due',
    version: 1,
  };
}

function approvedRequest(): DataRightsRequest {
  return {
    product: 'one_time_mishnayos',
    runtime_tier: 'isolated_staging',
    verification_environment_id: 'ci',
    request_id: 'request-1',
    kind: 'erasure',
    subject: {
      kind: 'student',
      student_id: 'student-1',
      household_id: 'household-1',
      relationship: 'dependent',
      self_adult_id: null,
    },
    requester_kind: 'account_owner',
    requester_ref: 'account-1',
    requester_household_id: 'household-1',
    relationship_evidence: 'dependent',
    recent_password_session_id: 'session-1',
    state: 'approved',
    visible_status: 'requested',
    requested_categories: ['student_profile'],
    excluded_categories: ['private_bodies'],
    legal_exception_codes: [],
    provider_cascades: [],
    dependent_review_required: true,
    dependent_review_completed: true,
    due_at: NOW.toISOString(),
    completed_at: null,
    terminal_reason_code: null,
    version: 3,
    audit_refs: ['audit-1'],
  };
}
