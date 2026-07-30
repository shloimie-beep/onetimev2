import type { CanonicalCopyMessage } from '../../copy/catalog.ts';
import { findCanonicalCopy } from '../../copy/catalog.ts';

function requireCanonicalCopy(id: string): CanonicalCopyMessage {
  const message = findCanonicalCopy(id);
  if (!message) throw new Error(`missing_canonical_copy:${id}`);
  return message;
}

export const PARENT_NEWSLETTER_COPY = requireCanonicalCopy('ghl.parent_newsletter.v1');
export const FORMER_MEMBER_REACTIVATION_STEP_ONE_COPY = requireCanonicalCopy(
  'ghl.former_member_reactivation.step_1.v1',
);

export const FORMER_MEMBER_REACTIVATION_STEPS = [
  {
    day: 0,
    copy_id: FORMER_MEMBER_REACTIVATION_STEP_ONE_COPY.id,
    subject: 'See what is new in One Time Mishnayos',
  },
  {
    day: 4,
    copy_id: 'ghl.former_member_reactivation.step_2.v1',
    subject: 'A separate Student portal for live class and recordings',
  },
  {
    day: 9,
    copy_id: 'ghl.former_member_reactivation.step_3.v1',
    subject: 'Come back free until September 13',
  },
] as const;

export const OT16_CHECKPOINT_DAYS = [14, 7, 3, 1, 0] as const;
export type Ot16CheckpointDays = (typeof OT16_CHECKPOINT_DAYS)[number];

export const OT16_STANDARD_FAMILY_PRICE = {
  amount: 67,
  currency: 'USD',
  cadence: 'month',
} as const;

export interface Ot16Notice {
  checkpoint_days: Ot16CheckpointDays;
  scheduled_at: string;
  subject: string;
  body: string;
  cta_label: 'Complete Checkout';
  expiry_at: string;
  price_amount: 67;
  price_currency: 'USD';
  automatic_charge_without_checkout: false;
  sender_key: 'office';
}

export function buildOt16Notice(input: {
  checkpoint_days: Ot16CheckpointDays;
  expiry_at: string;
}): Ot16Notice {
  const expiry = new Date(input.expiry_at);
  if (!Number.isFinite(expiry.getTime())) throw new Error('invalid_ot16_expiry');
  const scheduled = new Date(expiry.getTime() - input.checkpoint_days * 24 * 60 * 60 * 1_000);
  const checkpointLabel =
    input.checkpoint_days === 0 ? 'Your free period ends today' : 'Your free period is ending';
  return {
    checkpoint_days: input.checkpoint_days,
    scheduled_at: scheduled.toISOString(),
    subject: `${checkpointLabel} - complete Checkout to continue`,
    body: `Your One Time free period ends at ${input.expiry_at}. The standard Family price is $67 USD/month. No card is currently on file unless you voluntarily completed Checkout. No automatic charge will occur without completed Checkout. Complete Checkout to continue paid access.`,
    cta_label: 'Complete Checkout',
    expiry_at: input.expiry_at,
    price_amount: 67,
    price_currency: 'USD',
    automatic_charge_without_checkout: false,
    sender_key: 'office',
  };
}
