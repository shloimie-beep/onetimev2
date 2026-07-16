import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const OT87_PLAN_TRUTH =
  'Family plan — $67/month — up to 3 active learners in one household.';

const fixedTrialSchema = z
  .object({
    enabled: z.literal(false),
    days: z.literal(0),
    trialing_grants_access: z.literal(false),
  })
  .strict();

const requiredStripeEventSchema = z.enum([
  'checkout.session.completed',
  'checkout.session.expired',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_action_required',
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.closed',
]);

const statusGrantSchema = z
  .object({
    entitlement_status: z.string().min(1),
    grants_access: z.boolean(),
  })
  .strict();

export const ot87CommercialPolicySchema = z
  .object({
    schema_version: z.literal(1),
    policy_id: z.literal('ot87-family-monthly-usd-67-v1'),
    policy_version: z.literal('2026-07-15.1'),
    effective_from: z.literal('2026-07-15T00:00:00Z'),
    ownership: z
      .object({
        merchant: z.literal('One Time'),
        stripe_technical_administrator: z.literal('Shloimie'),
        application_product_owner: z.literal('Rabbi'),
      })
      .strict(),
    scope: z
      .object({
        account_key: z.literal('one_time'),
        product_key: z.literal('one_time_mishnah_class'),
        audience: z.literal('family'),
        school_checkout_enabled: z.literal(false),
        school_entitlement_enabled: z.literal(false),
        stripe_mode: z.literal('test'),
        live_stripe_charges_authorized: z.literal(false),
        required_live_guard: z
          .object({
            environment_variable: z.literal('LIVE_STRIPE_CHARGES_AUTHORIZED'),
            required_exact_value: z.literal('NO'),
          })
          .strict(),
      })
      .strict(),
    offer: z
      .object({
        offer_key: z.literal('family_monthly_usd_67_v1'),
        display_name: z.literal('Family plan'),
        currency: z.literal('usd'),
        unit_amount_cents: z.literal(6700),
        billing_scheme: z.literal('per_unit'),
        recurring_interval: z.literal('month'),
        recurring_interval_count: z.literal(1),
        quantity: z.literal(1),
        max_active_learner_seats: z.literal(3),
        trial: fixedTrialSchema,
        promotion_codes_enabled: z.literal(false),
        adjustable_quantity_enabled: z.literal(false),
      })
      .strict(),
    public_copy: z
      .object({
        landing_hero_price_visibility: z.literal('forbidden'),
        landing_ticker_price_visibility: z.literal('forbidden'),
        checkout_and_billing_surface_truth: z.literal(OT87_PLAN_TRUTH),
      })
      .strict(),
    grace_policy: z
      .object({
        policy_key: z.literal('ot87-zero-grace-v1'),
        implicit_grace_allowed: z.literal(false),
        past_due_grace_seconds: z.literal(0),
        unpaid_grace_seconds: z.literal(0),
        paused_grace_seconds: z.literal(0),
        access_during_past_due: z.literal(false),
        access_during_unpaid: z.literal(false),
        access_during_paused: z.literal(false),
      })
      .strict(),
    activation_policy: z
      .object({
        checkout_creation_grants_access: z.literal(false),
        success_redirect_grants_access: z.literal(false),
        checkout_completion_alone_grants_access: z.literal(false),
        required_truth: z.array(z.string().min(1)).length(5),
      })
      .strict(),
    cancellation_policy: z
      .object({
        portal_cancellation_mode: z.literal('at_period_end'),
        active_with_cancel_at_period_end: z
          .object({
            entitlement_status: z.literal('scheduled_end'),
            grants_access_until_current_period_end: z.literal(true),
          })
          .strict(),
        restored_before_period_end: z
          .object({
            entitlement_status: z.literal('active'),
            grants_access: z.literal(true),
          })
          .strict(),
        canceled_or_deleted_after_period_end: z
          .object({
            entitlement_status: z.literal('revoked'),
            grants_access: z.literal(false),
          })
          .strict(),
      })
      .strict(),
    refund_dispute_policy: z
      .object({
        full_refund_of_current_paid_invoice: statusGrantSchema.extend({
          entitlement_status: z.literal('suspended'),
          grants_access: z.literal(false),
          requires_reconciliation: z.literal(true),
        }),
        partial_refund_of_current_paid_invoice: statusGrantSchema.extend({
          entitlement_status: z.literal('manual_review'),
          grants_access: z.literal(false),
          requires_reconciliation: z.literal(true),
        }),
        dispute_created: statusGrantSchema.extend({
          entitlement_status: z.literal('suspended'),
          grants_access: z.literal(false),
          requires_reconciliation: z.literal(true),
        }),
        dispute_won: z
          .object({
            action: z.literal('recompute_from_current_subscription_and_invoice_truth'),
          })
          .strict(),
        dispute_lost: statusGrantSchema.extend({
          entitlement_status: z.literal('revoked'),
          grants_access: z.literal(false),
        }),
      })
      .strict(),
    subscription_status_policy: z
      .object({
        active: z
          .object({
            entitlement_status: z.literal('active_if_paid'),
            grants_access: z.literal('conditional'),
          })
          .strict(),
        trialing: statusGrantSchema
          .extend({
            entitlement_status: z.literal('manual_review'),
            grants_access: z.literal(false),
            reason: z.literal('trial_disabled_in_ot87_v1'),
          })
          .strict(),
        past_due: statusGrantSchema.extend({
          entitlement_status: z.literal('suspended'),
          grants_access: z.literal(false),
        }),
        unpaid: statusGrantSchema.extend({
          entitlement_status: z.literal('suspended'),
          grants_access: z.literal(false),
        }),
        paused: statusGrantSchema.extend({
          entitlement_status: z.literal('suspended'),
          grants_access: z.literal(false),
        }),
        incomplete: statusGrantSchema.extend({
          entitlement_status: z.literal('pending'),
          grants_access: z.literal(false),
        }),
        incomplete_expired: statusGrantSchema.extend({
          entitlement_status: z.literal('revoked'),
          grants_access: z.literal(false),
        }),
        canceled: z
          .object({
            entitlement_status: z.literal('revoked_unless_valid_period_end'),
            grants_access: z.literal('conditional'),
          })
          .strict(),
        unknown: statusGrantSchema.extend({
          entitlement_status: z.literal('manual_review'),
          grants_access: z.literal(false),
        }),
      })
      .strict(),
    seat_policy: z
      .object({
        scope: z.literal('household'),
        max_active_learners: z.literal(3),
        atomicity: z.string().min(1),
        fourth_active_learner_result: z.literal('LEARNER_LIMIT_REACHED'),
        school_seats_allowed: z.literal(false),
        administrative_roles_consume_seats: z.literal(false),
      })
      .strict(),
    required_stripe_events: z
      .array(requiredStripeEventSchema)
      .length(14)
      .refine((events) => new Set(events).size === events.length, {
        message: 'required_stripe_events must be unique',
      }),
    protected_configuration: z
      .object({
        server_only: z.tuple([
          z.literal('ONE_TIME_STRIPE_TEST_SECRET_KEY'),
          z.literal('ONE_TIME_STRIPE_TEST_WEBHOOK_SECRET'),
          z.literal('ONE_TIME_STRIPE_TEST_ACCOUNT_ID'),
          z.literal('ONE_TIME_STRIPE_TEST_PRODUCT_ID'),
          z.literal('ONE_TIME_STRIPE_TEST_PRICE_ID'),
          z.literal('ONE_TIME_STRIPE_TEST_PORTAL_CONFIGURATION_ID'),
          z.literal('ONE_TIME_STRIPE_TEST_WEBHOOK_ENDPOINT_ID'),
        ]),
        browser_safe_when_required: z.tuple([z.literal('ONE_TIME_STRIPE_TEST_PUBLISHABLE_KEY')]),
        operational_gates: z.tuple([
          z.literal('LIVE_STRIPE_CHARGES_AUTHORIZED'),
          z.literal('ONE_TIME_STRIPE_TEST_RESOURCE_SETUP_AUTHORIZED'),
          z.literal('ONE_TIME_STRIPE_TEST_CANARY_AUTHORIZED'),
          z.literal('ONE_TIME_STRIPE_TEST_RECONCILIATION_APPLY_AUTHORIZED'),
        ]),
        resource_ids_must_not_be_embedded_in_source_or_prompt: z.literal(true),
      })
      .strict(),
  })
  .strict();

export type Ot87CommercialPolicy = z.infer<typeof ot87CommercialPolicySchema>;

export function loadOt87CommercialPolicy(
  policyPath = path.resolve(process.cwd(), 'ops/commercial/ot87/family-plan.v1.json'),
): Ot87CommercialPolicy {
  return ot87CommercialPolicySchema.parse(JSON.parse(readFileSync(policyPath, 'utf8')));
}
