import assert from 'node:assert/strict';

import {
  evaluateCanaryLedger,
  PRODUCTION_OPERATOR_CANARY_BUDGET,
  type CanaryLedgerEntry,
} from './index.ts';

const digest = 'c'.repeat(64);
const base = {
  verification_environment_id: 'production_operator_canary',
  runtime_tier: 'production',
  credential_boundary: 'live',
  candidate_sha: digest,
  authorization_digest: digest,
  operator_owned_scope_confirmed: true,
  backup_restore_gate_passed: true,
  rollback_gate_passed: true,
  legal_artifact_gate_passed: true,
  acceptance_unknown: false,
  stop_condition_observed: false,
} as const;

function completeLedger(overrides: readonly CanaryLedgerEntry[] = []): CanaryLedgerEntry[] {
  const byEffect = new Map(overrides.map((entry) => [entry.effect, entry]));
  return Object.keys(PRODUCTION_OPERATOR_CANARY_BUDGET).map(
    (effect) =>
      byEffect.get(effect) ?? {
        effect,
        attempted: 0,
        succeeded: 0,
        reconciled: 0,
      },
  );
}

const reconciled = evaluateCanaryLedger({
  ...base,
  entries: completeLedger([
    {
      effect: 'email.resend_messages',
      attempted: 1,
      succeeded: 1,
      reconciled: 1,
    },
  ]),
});
assert.equal(reconciled.passed, true);
assert.deepEqual(reconciled.totals, {
  attempted: 1,
  succeeded: 1,
  reconciled: 1,
});

const centPreciseCharge = evaluateCanaryLedger({
  ...base,
  entries: completeLedger([
    {
      effect: 'stripe.live_charge_total_usd',
      attempted: 66.5,
      succeeded: 66.5,
      reconciled: 66.5,
    },
  ]),
});
assert.equal(centPreciseCharge.passed, true);

const exceeded = evaluateCanaryLedger({
  ...base,
  entries: completeLedger([
    {
      effect: 'whatsapp.messages',
      attempted: 1,
      succeeded: 1,
      reconciled: 0,
    },
  ]),
});
assert.equal(exceeded.passed, false);
assert.equal(exceeded.disposition, 'stop_and_reconcile');
assert.ok(exceeded.issues.some(({ code }) => code === 'CANARY_BUDGET_EXCEEDED'));
assert.ok(exceeded.issues.some(({ code }) => code === 'CANARY_EFFECT_UNRECONCILED'));

const legalGateOpen = evaluateCanaryLedger({
  ...base,
  legal_artifact_gate_passed: false,
  entries: completeLedger(),
});
assert.equal(legalGateOpen.disposition, 'blocked');
assert.ok(legalGateOpen.issues.some(({ code }) => code === 'CANARY_LEGAL_GATE_OPEN'));

const omittedEffectClass = evaluateCanaryLedger({
  ...base,
  entries: completeLedger().slice(1),
});
assert.equal(omittedEffectClass.passed, false);
assert.equal(omittedEffectClass.disposition, 'stop_and_reconcile');
assert.ok(omittedEffectClass.issues.some(({ code }) => code === 'CANARY_EFFECT_MISSING'));

process.stdout.write('P34 bounded canary accounting checks passed.\n');
