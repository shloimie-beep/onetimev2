import { describe, expect, it } from 'vitest';
import {
  OPS03_ACTION_BY_PROVIDER,
  assertOps03RedactionClean,
  decideOps03ProviderStatus,
  evaluateOps03Cardinality,
  scanTextForOps03Leaks,
  validateOps03AuthorizationRecord,
} from '../../packages/domain/src/ops03/canary-conductor.ts';

const exactSha = '62ad1d39242f1a8745ad5da5c2a016301eb276c3';

describe('OPS-03 canary conductor policy', () => {
  it('validates a single-provider single-action authorization record', () => {
    const valid = validateOps03AuthorizationRecord(
      {
        schema_version: '1.0.0',
        task_id: 'OPS-03',
        authorization_id: 'OPS-03-AUTH-EMAIL1',
        provider: 'email',
        environment: 'staging',
        integrated_staging_sha: exactSha,
        target_alias: 'ops03-sink',
        action: OPS03_ACTION_BY_PROVIDER.email,
        authorized_from: '2026-07-16T00:00:00Z',
        authorized_until: '2026-07-17T00:00:00Z',
        approver_ref: 'OPS-03-APPROVER-OWNER',
        cleanup_authorization: 'disable_only',
      },
      { exactStagingSha: exactSha, provider: 'email', now: new Date('2026-07-16T06:00:00Z') },
    );
    expect(valid).toMatchObject({ ok: true, provider: 'email' });
  });

  it('rejects provider/action mismatch and wrong SHA', () => {
    const invalid = validateOps03AuthorizationRecord(
      {
        schema_version: '1.0.0',
        task_id: 'OPS-03',
        authorization_id: 'OPS-03-AUTH-TELEGRAM1',
        provider: 'telegram',
        environment: 'staging',
        integrated_staging_sha: exactSha,
        target_alias: 'ops03-owner',
        action: OPS03_ACTION_BY_PROVIDER.email,
        authorized_from: '2026-07-16T00:00:00Z',
        authorized_until: '2026-07-17T00:00:00Z',
        approver_ref: 'OPS-03-APPROVER-OWNER',
        cleanup_authorization: 'disable_only',
      },
      {
        exactStagingSha: 'b8e6f2f1234567890abcdef1234567890abcdef1',
        provider: 'telegram',
        now: new Date('2026-07-16T06:00:00Z'),
      },
    );
    expect(invalid.ok).toBe(false);
    expect(invalid.reason_codes).toContain('OPS-03-PROVIDER-AUTHORIZATION-MISSING-OR-INVALID');
  });

  it('enforces exactly one target alias and exactly one allowed action', () => {
    expect(
      evaluateOps03Cardinality({
        targetAliases: ['ops03-sink'],
        actions: [OPS03_ACTION_BY_PROVIDER.email],
      }),
    ).toMatchObject({ passed: true, blocker_codes: [] });
    expect(
      evaluateOps03Cardinality({
        targetAliases: ['ops03-sink', 'ops03-second'],
        actions: [OPS03_ACTION_BY_PROVIDER.email],
      }).blocker_codes,
    ).toContain('OPS-03-PROVIDER-ONE-TARGET-FAILED');
  });

  it('scans artifacts for provider URLs, recipient identifiers, and credential-shaped text', () => {
    expect(scanTextForOps03Leaks('safe logical alias ops03-sink')).toHaveLength(0);
    expect(scanTextForOps03Leaks('send to owner@example.test')).toHaveLength(1);
    expect(() => assertOps03RedactionClean('launch_url should not be written')).toThrow(
      /redaction/,
    );
  });

  it('uses the closed status decision order', () => {
    expect(
      decideOps03ProviderStatus({
        configured: false,
        hardBlocked: true,
        technicalReady: false,
        canaryPassed: false,
      }),
    ).toBe('unconfigured');
    expect(
      decideOps03ProviderStatus({
        configured: true,
        hardBlocked: true,
        technicalReady: true,
        canaryPassed: false,
      }),
    ).toBe('blocked');
    expect(
      decideOps03ProviderStatus({
        configured: true,
        hardBlocked: false,
        technicalReady: true,
        canaryPassed: false,
      }),
    ).toBe('ready_for_canary');
  });
});
