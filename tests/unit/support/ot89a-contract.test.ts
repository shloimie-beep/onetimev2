import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { supportEventV1Schema } from '../../../packages/contracts/src/support/index.ts';
import { ot89CanonicalString, signOt89Request } from '../../../packages/domain/src/support/hmac.ts';
import { SUPPORT_CLAIM_BATCH_SQL } from '../../../packages/domain/src/support/worker.ts';

const contractPath = 'ops/codex-runs/OT-89A/SUPPORT-EVENT-CONTRACT.json';
const expectedContractSha = 'cfcd0ac55cbf9e59d7fefc7779af1aa5112fb410ee510882cb843492a556e512';

describe('OT-89A frozen support event contract', () => {
  it('keeps the preserved JSON contract byte-for-byte frozen and validates the example', () => {
    const raw = readFileSync(contractPath);
    expect(createHash('sha256').update(raw).digest('hex')).toBe(expectedContractSha);
    const contract = JSON.parse(raw.toString('utf8')) as {
      examples: unknown[];
    };
    const example = contract.examples[0];
    expect(supportEventV1Schema.safeParse(example).success).toBe(true);

    expect(
      supportEventV1Schema.safeParse({ ...(example as object), unexpected: true }).success,
    ).toBe(false);
    expect(
      supportEventV1Schema.safeParse({
        ...(example as Record<string, unknown>),
        event_type: 'onetime.support.ticket.submitted.v2',
      }).success,
    ).toBe(false);
    expect(
      supportEventV1Schema.safeParse({
        ...(example as Record<string, unknown>),
        contract_version: '1.0.1',
      }).success,
    ).toBe(false);
    expect(
      supportEventV1Schema.safeParse({
        ...(example as Record<string, unknown>),
        ticket: { ...(example as { ticket: object }).ticket, category: 'future' },
      }).success,
    ).toBe(false);
  });

  it('reproduces the frozen HMAC interoperability vector exactly', () => {
    const rawBody = '{"contract_version":"1.0.0","event_id":"evt_01J00000000000000000000000"}';
    const canonical = ot89CanonicalString({
      method: 'POST',
      requestTarget: '/api/internal/integrations/onetime/support-events/v1',
      timestamp: '1784116800',
      nonce: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYX',
      rawBody,
    });
    expect(createHash('sha256').update(rawBody).digest('hex')).toBe(
      '2046bb01ef883c374a07c480a1c915c610930f4e3827c052f0e166e10abce2e5',
    );
    expect(canonical).toBe(
      [
        'POST',
        '/api/internal/integrations/onetime/support-events/v1',
        '1784116800',
        'AAECAwQFBgcICQoLDA0ODxAREhMUFRYX',
        '2046bb01ef883c374a07c480a1c915c610930f4e3827c052f0e166e10abce2e5',
      ].join('\n'),
    );
    expect(
      signOt89Request({
        method: 'POST',
        requestTarget: '/api/internal/integrations/onetime/support-events/v1',
        timestamp: '1784116800',
        nonce: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYX',
        rawBody,
        secret: 'ot89-test-secret-do-not-use',
      }),
    ).toBe('v1=dddf2aa3aa413fad852e37237ad3355ec70f7bd7a1876fa5f260eed882570773');
  });

  it('keeps support outbox claims scoped, atomic, and skip-locked for PostgreSQL workers', () => {
    expect(SUPPORT_CLAIM_BATCH_SQL).toContain('FOR UPDATE SKIP LOCKED');
    expect(SUPPORT_CLAIM_BATCH_SQL).toContain('outbox.account_key = $1');
    expect(SUPPORT_CLAIM_BATCH_SQL).toContain('outbox.product_key = $2');
    expect(SUPPORT_CLAIM_BATCH_SQL).toContain("outbox.status = 'PENDING'");
    expect(SUPPORT_CLAIM_BATCH_SQL).toContain("outbox.status = 'PROCESSING'");
    expect(SUPPORT_CLAIM_BATCH_SQL).toContain("SET status = 'PROCESSING'");
    expect(SUPPORT_CLAIM_BATCH_SQL).toContain('attempts = outbox.attempts + 1');
  });
});
