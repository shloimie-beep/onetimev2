import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createOt74AudienceReconciliationRouter,
  type Ot74AudienceRepository,
  type Ot74AudienceSession,
} from '../../apps/web/src/server/features/audience-reconciliation/router.ts';
import { createLegacyAudienceDryRun } from '../../packages/domain/src/audience-reconciliation/service.ts';
import type { LegacyAudienceDryRunReport } from '../../packages/contracts/src/audience-reconciliation/index.ts';

describe('OT-74 audience reconciliation router', () => {
  const servers: Array<{ close: () => void }> = [];

  afterEach(() => {
    for (const server of servers.splice(0)) server.close();
  });

  it('returns 401 before repository access when authentication is absent', async () => {
    const harness = await createHarness({ session: null });
    const response = await fetch(`${harness.baseUrl}/api/v1/audience-reconciliation/contracts`);
    expect(response.status).toBe(401);
    expect(harness.calls).toEqual([]);
  });

  it('returns 403 before csrf and repository access when capability is missing', async () => {
    const harness = await createHarness({ role: 'viewer' });
    const response = await fetch(`${harness.baseUrl}/api/v1/audience-reconciliation/dry-runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(dryRunBody()),
    });
    expect(response.status).toBe(403);
    expect(harness.csrfChecks).toBe(0);
    expect(harness.calls).toEqual([]);
  });

  it('checks csrf before dry-run repository access', async () => {
    const harness = await createHarness({ csrfValid: false });
    const response = await fetch(`${harness.baseUrl}/api/v1/audience-reconciliation/dry-runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(dryRunBody()),
    });
    expect(response.status).toBe(403);
    expect(harness.csrfChecks).toBe(1);
    expect(harness.calls).toEqual([]);
  });

  it('records a dry run and returns summary-only output', async () => {
    const harness = await createHarness({});
    const response = await fetch(`${harness.baseUrl}/api/v1/audience-reconciliation/dry-runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(dryRunBody()),
    });
    const body = (await response.json()) as {
      success: boolean;
      replayed: boolean;
      report: Record<string, unknown>;
    };
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.replayed).toBe(false);
    expect(body.report.summary).toMatchObject({ total_rows: 1 });
    expect(body.report).not.toHaveProperty('row_outcomes');
    expect(JSON.stringify(body)).not.toContain('router@example.test');
    expect(harness.calls).toEqual(['findContactsByIdentities', 'recordDryRun']);
  });

  it('records a campaign preview and returns counts without recipient row lists', async () => {
    const report = dryRunReport();
    const harness = await createHarness({ batchReport: report });
    const response = await fetch(
      `${harness.baseUrl}/api/v1/audience-reconciliation/batches/${report.batch_key}/campaign-previews`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          idempotency_key: 'router-preview-001',
          segment: 'active_legacy_family_users',
          channel: 'email',
          template_revision: 'draft-day-one-activation-v1',
          batch_size: 10,
        }),
      },
    );
    const body = (await response.json()) as {
      success: boolean;
      preview: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.preview).not.toHaveProperty('recipient_row_keys');
    expect(body.preview).toMatchObject({
      raw_recipient_list_included: false,
      message_body_included: false,
      production_side_effects: false,
    });
    expect(JSON.stringify(body)).not.toContain('campaign-router@example.test');
    expect(harness.calls).toEqual(['getBatchReport', 'recordCampaignPreview']);
  });

  it('returns governed taxonomy without row values', async () => {
    const harness = await createHarness({});
    const response = await fetch(`${harness.baseUrl}/api/v1/audience-reconciliation/taxonomy`);
    const body = (await response.json()) as {
      success: boolean;
      taxonomy: Array<{ fact_code: string }>;
      raw_values_included: boolean;
      production_side_effects: boolean;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.taxonomy.map((fact) => fact.fact_code)).toContain('campaign_candidate');
    expect(body.raw_values_included).toBe(false);
    expect(body.production_side_effects).toBe(false);
  });

  it('records source inventory and apply plans without exposing raw values', async () => {
    const report = dryRunReport();
    const harness = await createHarness({ batchReport: report });
    const inventoryResponse = await fetch(
      `${harness.baseUrl}/api/v1/audience-reconciliation/source-inventories`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sourceInventoryBody()),
      },
    );
    const inventory = (await inventoryResponse.json()) as Record<string, unknown>;

    expect(inventoryResponse.status).toBe(200);
    expect(JSON.stringify(inventory)).not.toContain('router@example.test');

    const applyResponse = await fetch(
      `${harness.baseUrl}/api/v1/audience-reconciliation/batches/${report.batch_key}/apply-plans`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          idempotency_key: 'router-apply-plan-001',
          mode: 'dry_run',
          manifest_sha256: report.source_digest,
          expected_total_rows: report.summary.total_rows,
          expected_unique_rows: report.summary.unique_rows,
          expected_manual_review_rows: report.summary.manual_review_rows,
          target_environment: 'test',
        }),
      },
    );
    const apply = (await applyResponse.json()) as {
      success: boolean;
      apply_plan: { real_bulk_import_applied: boolean; production_side_effects: boolean };
    };

    expect(applyResponse.status).toBe(200);
    expect(apply.success).toBe(true);
    expect(apply.apply_plan.real_bulk_import_applied).toBe(false);
    expect(apply.apply_plan.production_side_effects).toBe(false);
    expect(harness.calls).toEqual(['recordSourceInventory', 'getBatchReport', 'recordApplyPlan']);
  });

  it('records conflict decisions behind csrf without raw contact data', async () => {
    const report = dryRunReport();
    const harness = await createHarness({});
    const response = await fetch(
      `${harness.baseUrl}/api/v1/audience-reconciliation/batches/${report.batch_key}/conflict-decisions`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          row_key: report.row_outcomes[0]?.row_key,
          idempotency_key: 'router-conflict-001',
          decision: 'needs_more_info',
          reason: 'Synthetic review stays blocked until source owner confirms.',
        }),
      },
    );
    const body = (await response.json()) as {
      success: boolean;
      decision: { production_side_effects: boolean };
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.decision.production_side_effects).toBe(false);
    expect(JSON.stringify(body)).not.toContain('campaign-router@example.test');
    expect(harness.calls).toEqual(['recordConflictDecision']);
  });

  async function createHarness(options: {
    session?: Ot74AudienceSession | null;
    role?: string;
    csrfValid?: boolean;
    batchReport?: LegacyAudienceDryRunReport | null;
  }) {
    const calls: string[] = [];
    let csrfChecks = 0;
    const session =
      options.session === null
        ? null
        : {
            sessionKey: 'session_ot74',
            actor: {
              accountKey: 'acct_ot74',
              productKey: 'prod_ot74',
              userKey: 'user_ot74',
              role: options.role ?? 'owner',
            },
          };
    const app = express();
    app.use(
      '/api/v1/audience-reconciliation',
      createOt74AudienceReconciliationRouter({
        guards: {
          loadSession: async () => session,
          verifyCsrf: async () => {
            csrfChecks += 1;
            return options.csrfValid !== false;
          },
        },
        repository: repositoryWithCalls(calls, options.batchReport),
      }),
    );
    const server = await new Promise<import('node:http').Server>((resolve) => {
      const started = app.listen(0, () => resolve(started));
    });
    servers.push(server);
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing test server port');
    return {
      baseUrl: `http://127.0.0.1:${address.port}`,
      calls,
      get csrfChecks() {
        return csrfChecks;
      },
    };
  }
});

function repositoryWithCalls(
  calls: string[],
  batchReport: LegacyAudienceDryRunReport | null | undefined = null,
): Ot74AudienceRepository {
  return {
    findContactsByIdentities: async () => {
      calls.push('findContactsByIdentities');
      return [];
    },
    recordDryRun: async ({ report }) => {
      calls.push('recordDryRun');
      return { report, replayed: false };
    },
    recordSourceInventory: async ({ manifest }) => {
      calls.push('recordSourceInventory');
      return { manifest, replayed: false };
    },
    getBatchReport: async () => {
      calls.push('getBatchReport');
      return batchReport ?? null;
    },
    recordRollbackRequest: async () => {
      calls.push('recordRollbackRequest');
      return {
        rollback_key: 'rollback_test',
        batch_key: 'batch_test',
        status: 'recorded',
        replayed: false,
      };
    },
    recordConflictDecision: async (_actor, request) => {
      calls.push('recordConflictDecision');
      return {
        decision_key: 'decision_test',
        batch_key: request.batch_key,
        row_key: request.row_key,
        decision: request.decision,
        replayed: false,
        production_side_effects: false,
      };
    },
    recordApplyPlan: async ({ result }) => {
      calls.push('recordApplyPlan');
      return { result, replayed: false };
    },
    recordCampaignPreview: async ({ preview }) => {
      calls.push('recordCampaignPreview');
      return { preview, replayed: false };
    },
    getCampaignRecord: async () => {
      calls.push('getCampaignRecord');
      return null;
    },
    approveCampaign: async ({ approval }) => {
      calls.push('approveCampaign');
      return { approval, replayed: false };
    },
    recordCampaignSendIntents: async ({ result }) => {
      calls.push('recordCampaignSendIntents');
      return { result, replayed: false };
    },
    recordCampaignControl: async ({ campaignKey, request }) => {
      calls.push('recordCampaignControl');
      return {
        campaign_key: campaignKey,
        action: request.action,
        status:
          request.action === 'cancel'
            ? 'cancelled'
            : request.action === 'pause'
              ? 'paused'
              : 'running',
        replayed: false,
        production_side_effects: false,
      };
    },
  };
}

function sourceInventoryBody() {
  return {
    inventory_key: 'legacy_source_inventory_router',
    generated_at: '2026-07-17T09:00:00.000Z',
    generated_by: 'router-test',
    source_roots: ['Downloads'],
    files: [
      {
        file_ref: 'legacy_source_file_router',
        source_root_label: 'Downloads',
        file_name: 'Rabbi Scheller Followers.xlsx',
        extension: '.xlsx',
        byte_size: 1234,
        last_modified: '2026-07-17T09:00:00.000Z',
        sha256: 'a'.repeat(64),
        duplicate_of_sha256: null,
        classification: 'proven_one_time',
        classification_reasons: ['one_time_or_rabbi_filename_or_columns'],
        sheet_names: ['Followers'],
        column_names_by_sheet: { Followers: ['Name', 'Email'] },
        row_counts_by_sheet: { Followers: 12 },
        warnings: ['possible_pii_columns_detected'],
        raw_values_included: false,
      },
    ],
    summary: {
      file_count: 1,
      proven_one_time: 1,
      mixed_needs_review: 0,
      unrelated: 0,
      duplicate: 0,
      unsupported_files: 0,
      possible_pii_files: 1,
    },
    manifest_sha256: 'b'.repeat(64),
    raw_values_included: false,
    production_side_effects: false,
  };
}

function dryRunReport() {
  return createLegacyAudienceDryRun({
    scope: { accountKey: 'acct_ot74', productKey: 'prod_ot74' },
    request: {
      idempotency_key: 'router-preview-source-001',
      source: {
        kind: 'csv_normalized' as const,
        source_label: 'router-fixture',
        worksheet_label: 'router',
      },
      rows: [
        {
          source_row_number: 2,
          display_name: 'Router Person',
          email: 'campaign-router@example.test',
          phone: '',
          audience_type: 'family' as const,
          legacy_system_state: 'present' as const,
          active_legacy_user: true,
          new_system_activated: false,
          lead_state: 'lead' as const,
          consent_state: 'opted_in',
          suppression_state: 'active' as const,
          source_tags: [],
        },
      ],
    },
    existingContacts: [],
    now: new Date('2026-07-16T09:00:00.000Z'),
  });
}

function dryRunBody() {
  return {
    idempotency_key: 'router-idempotency-001',
    source: {
      kind: 'csv_normalized',
      source_label: 'router-fixture',
      worksheet_label: 'router',
    },
    rows: [
      {
        source_row_number: 2,
        display_name: 'Router Person',
        email: 'router@example.test',
        phone: '',
        audience_type: 'family',
        legacy_system_state: 'present',
        active_legacy_user: true,
        new_system_activated: false,
        lead_state: 'lead',
        consent_state: 'opted_in',
        suppression_state: 'active',
        source_tags: [],
      },
    ],
  };
}
