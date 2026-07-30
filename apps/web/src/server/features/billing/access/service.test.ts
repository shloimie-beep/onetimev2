import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createMemoryBillingAccessRepository } from '../../../../../../../packages/db/src/billing/access/index.ts';
import { receiveSignedBillingEvent } from './index.ts';

const SECRET = 'local-test-signing-secret';
const NOW = new Date('2026-07-01T00:00:30.000Z');

describe('signed billing event receipt', () => {
  it('verifies, minimizes, projects, and safely replays a signed event', async () => {
    const repository = createMemoryBillingAccessRepository();
    const rawBody = JSON.stringify({
      event_id: 'paid-1',
      household_id: 'household-a',
      provider_customer_ref_hash: 'a'.repeat(64),
      billing_term_id: 'term-1',
      kind: 'term_paid',
      occurred_at: '2026-07-01T00:00:00.000Z',
      term_ends_at: '2026-08-01T00:00:00.000Z',
      ignored_financial_payload: { amount: 1234 },
    });
    const signatureHeader = sign(rawBody, NOW);

    const first = await receiveSignedBillingEvent({
      raw_body: rawBody,
      signature_header: signatureHeader,
      signing_secret: SECRET,
      received_at: NOW,
      repository,
    });
    const replay = await receiveSignedBillingEvent({
      raw_body: rawBody,
      signature_header: signatureHeader,
      signing_secret: SECRET,
      received_at: NOW,
      repository,
    });

    expect(first.projection.state).toBe('active');
    expect(first.duplicate).toBe(false);
    expect(replay.duplicate).toBe(true);
    expect(first.receipt).not.toHaveProperty('ignored_financial_payload');
  });

  it('rejects invalid and stale signatures before projection', async () => {
    const repository = createMemoryBillingAccessRepository();
    const rawBody = JSON.stringify({
      event_id: 'paid-1',
      household_id: 'household-a',
      provider_customer_ref_hash: 'a'.repeat(64),
      billing_term_id: 'term-1',
      kind: 'term_paid',
      occurred_at: '2026-07-01T00:00:00.000Z',
      term_ends_at: '2026-08-01T00:00:00.000Z',
    });
    await expect(
      receiveSignedBillingEvent({
        raw_body: rawBody,
        signature_header: `t=${Math.floor(NOW.getTime() / 1_000)},v1=${'0'.repeat(64)}`,
        signing_secret: SECRET,
        received_at: NOW,
        repository,
      }),
    ).rejects.toMatchObject({ code: 'signature_invalid' });

    const old = new Date(NOW.getTime() - 10 * 60 * 1_000);
    await expect(
      receiveSignedBillingEvent({
        raw_body: rawBody,
        signature_header: sign(rawBody, old),
        signing_secret: SECRET,
        received_at: NOW,
        repository,
      }),
    ).rejects.toMatchObject({ code: 'signature_stale' });
    expect(await repository.getProjection('household-a')).toBeNull();
  });
});

function sign(rawBody: string, at: Date): string {
  const timestamp = Math.floor(at.getTime() / 1_000);
  const signature = createHmac('sha256', SECRET)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}
