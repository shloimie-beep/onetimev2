import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildCampaignSeedApprovalPacket,
  formatCampaignSeedApprovalPacket,
} from '../../../scripts/w12-100/campaign/campaign-seed-approval-packet.ts';

describe('campaign seed approval packet', () => {
  it('creates a no-send approval packet from sanitized CRM evidence', async () => {
    const fixture = await writeFixtureFiles();
    const packet = await buildCampaignSeedApprovalPacket({
      now: new Date('2026-07-19T17:20:00.000Z'),
      crmApplyPath: fixture.applyPath,
      crmReconcilePath: fixture.reconcilePath,
      productionSignupProofPath: fixture.signupPath,
    });
    const markdown = formatCampaignSeedApprovalPacket(packet);

    expect(packet.status).toBe('ready_for_operator_approval');
    expect(packet.blocked_reasons).toEqual([]);
    expect(packet.audience).toMatchObject({
      segment: 'one_time_real_crm_email_campaign_eligible',
      channel: 'email',
      eligible_count: 1357,
      seed_requested_count: 1,
      broad_requested_count: 0,
      whatsapp_eligible_count: 0,
      raw_recipient_list_included: false,
    });
    expect(packet.proposed_seed_copy.subject).toBe(
      'Join One Time Mishnayos with Rabbi Eli Scheller',
    );
    expect(packet.approval.required_operator_approval_statement).toBe(
      `APPROVE_ONE_TIME_CAMPAIGN_SEED:${packet.snapshot_hash}:1357:email:seed-only`,
    );
    expect(packet.approval.seed_send_authorized).toBe(false);
    expect(packet.approval.broad_campaign_authorized).toBe(false);
    expect(packet.safety).toMatchObject({
      production_side_effects: false,
      database_writes_performed: false,
      external_send_performed: false,
      provider_mutation_count: 0,
      private_destination_included: false,
      raw_values_included: false,
      broad_campaign_sends: 0,
    });
    expect(markdown).toContain('Seed send authorized now: false');
    expect(markdown).toContain('Broad campaign authorized now: false');
    expect(markdown).not.toContain('canary@example.test');
  });

  it('blocks when the CRM apply evidence is not applied and replayed cleanly', async () => {
    const fixture = await writeFixtureFiles({
      apply: { status: 'blocked', counts: { sends_queued: 1 } },
      reconcile: { replay_database_writes_performed: true },
    });
    const packet = await buildCampaignSeedApprovalPacket({
      now: new Date('2026-07-19T17:20:00.000Z'),
      crmApplyPath: fixture.applyPath,
      crmReconcilePath: fixture.reconcilePath,
      productionSignupProofPath: fixture.signupPath,
    });

    expect(packet.status).toBe('blocked');
    expect(packet.blocked_reasons).toEqual(
      expect.arrayContaining([
        'CRM_APPLY_NOT_APPLIED',
        'CRM_APPLY_SENDS_QUEUED',
        'CRM_REPLAY_WRITES_NOT_FALSE',
      ]),
    );
    expect(packet.safety.external_send_performed).toBe(false);
  });
});

async function writeFixtureFiles(
  overrides: {
    apply?: Record<string, unknown>;
    reconcile?: Record<string, unknown>;
    signup?: Record<string, unknown>;
  } = {},
) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'campaign-seed-approval-'));
  const applyPath = path.join(dir, 'apply.json');
  const reconcilePath = path.join(dir, 'reconcile.json');
  const signupPath = path.join(dir, 'signup.json');
  await writeFile(applyPath, JSON.stringify(mergeDeep(baseApply(), overrides.apply ?? {})));
  await writeFile(
    reconcilePath,
    JSON.stringify(mergeDeep(baseReconcile(), overrides.reconcile ?? {})),
  );
  await writeFile(signupPath, JSON.stringify(mergeDeep(baseSignup(), overrides.signup ?? {})));
  return { applyPath, reconcilePath, signupPath };
}

function baseApply() {
  return {
    status: 'applied',
    batch_key: 'crm_real_source_batch_fixture',
    target_environment: 'production',
    dry_run_report_sha256: 'a'.repeat(64),
    counts: {
      total_rows: 2505,
      unique_identity_count: 1596,
      crm_importable: 1559,
      inserted_contacts: 1555,
      skipped_existing_contacts: 4,
      email_campaign_eligible: 1357,
      whatsapp_campaign_eligible: 0,
      suppressed: 152,
      sends_queued: 0,
    },
    safety: {
      raw_values_included: false,
      raw_values_printed: false,
      external_sends_performed: false,
      provider_mutation_count: 0,
    },
  };
}

function baseReconcile() {
  return {
    apply_status: 'applied',
    replay_status: 'replayed',
    replay_database_writes_performed: false,
    dry_run_report_sha256: 'a'.repeat(64),
    counts: {
      contacts_total: 1555,
      import_batches: 1,
      import_rows: 2505,
      outbox_events_total: 0,
      latest_migration: '2204_w12_100_real_source_crm_apply',
    },
    channel_counts: {
      email_campaign_eligible: 1357,
      whatsapp_campaign_eligible: 0,
      suppressed_rows: 152,
      raw_values_excluded_rows: 2505,
    },
    safety: {
      raw_values_included: false,
      raw_values_printed: false,
      external_sends_performed: false,
      provider_mutation_count: 0,
      sends_queued: 0,
    },
  };
}

function baseSignup() {
  return {
    first_status: 200,
    second_status: 200,
    duplicate_submission_on_replay: true,
    counts: {
      contact_rows: 1,
      signup_rows: 1,
      outbox_rows: 2,
      whatsapp_outbox_rows: 0,
      raw_value_rows: 0,
    },
    safety: {
      raw_email_included: false,
      raw_phone_included: false,
      provider_mutation_count: 0,
      broad_campaign_sends: 0,
    },
  };
}

function mergeDeep<T>(target: T, source: Record<string, unknown>): T {
  if (!source || typeof source !== 'object') return target;
  const output: Record<string, unknown> = { ...(target as Record<string, unknown>) };
  for (const [key, value] of Object.entries(source)) {
    const current = output[key];
    output[key] =
      current &&
      typeof current === 'object' &&
      !Array.isArray(current) &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
        ? mergeDeep(current, value as Record<string, unknown>)
        : value;
  }
  return output as T;
}
