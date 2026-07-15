import {
  oversightOutcomeSchema,
  type OversightOutcome,
  type OversightOutcomeCategory,
} from '../../../contracts/src/providers/oversight.ts';
import { stableProviderKey } from './shared.ts';

export function buildOversightOutcome(input: {
  sourceSha: string;
  accountKey: string;
  productKey: string;
  category: OversightOutcomeCategory;
  producedAt: Date;
  staleAfter: Date;
  summary: OversightOutcome['summary'];
  signatureRef?: string | null;
}): OversightOutcome {
  const event = {
    schema_version: 1 as const,
    event_id: stableProviderKey('oversight', [
      input.sourceSha,
      input.accountKey,
      input.productKey,
      input.category,
      input.producedAt.toISOString(),
    ]),
    source_sha: input.sourceSha,
    account_key: input.accountKey,
    product_key: input.productKey,
    category: input.category,
    produced_at: input.producedAt.toISOString(),
    stale_after: input.staleAfter.toISOString(),
    summary: input.summary,
    signature_ref: input.signatureRef ?? null,
  };
  return oversightOutcomeSchema.parse(event);
}
