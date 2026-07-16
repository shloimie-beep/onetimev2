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
