import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { highLevelOutboundEventSchema } from '../../../packages/contracts/src/highlevel/index.ts';
import {
  ONE_TIME_CLASS_REMINDER_HOUR,
  ONE_TIME_CLASS_REMINDER_MINUTE,
  ONE_TIME_CLASS_START_HOUR,
  ONE_TIME_CLASS_START_MINUTE,
} from '../../../packages/domain/src/classes/schedule.ts';
import {
  EXECUTABLE_WORKFLOW_JOB_IDS,
  buildExecutableWorkflowReport,
  executableWorkflowSpecs,
  otE01RepairSubjob,
} from '../../../scripts/highlevel/agent-mode-executable-specs.ts';

const repoRoot = process.cwd();

describe('HighLevel executable Agent Mode jobs', () => {
  it('queues and exports the five exact reviewed jobs without duplicating OT-E01', async () => {
    const queue = await json<{
      schema_version: string;
      ordered_jobs: Array<{
        job_id: string;
        job_file: string;
        workflow_id?: string;
        reviewed_subjob_ids?: string[];
      }>;
    }>('integrations/highlevel/agent-mode/GHL-AGENT-MODE-QUEUE.json');
    const agentExport = await json<{
      schema_version: string;
      jobs: Array<{ job_id: string; execution_contract?: unknown; reviewed_subjobs?: unknown[] }>;
    }>('integrations/highlevel/agent-mode/GHL-AGENT-MODE-EXPORT.json');

    expect(queue.schema_version).toBe('1.2.0');
    expect(agentExport.schema_version).toBe('1.2.0');
    for (const spec of executableWorkflowSpecs) {
      const entry = queue.ordered_jobs.find((candidate) => candidate.job_id === spec.job_id);
      const exported = agentExport.jobs.find((candidate) => candidate.job_id === spec.job_id);
      expect(entry?.workflow_id).toBe(spec.workflow.ghl_id);
      expect(exported?.execution_contract).toEqual(spec);
      expect(await json(entry!.job_file)).toEqual(exported);
    }

    const job04 = queue.ordered_jobs.find((candidate) => candidate.job_id === 'GHL-UI-04');
    expect(job04?.reviewed_subjob_ids).toEqual([otE01RepairSubjob.subjob_id]);
    expect(
      agentExport.jobs.filter((job) =>
        job.reviewed_subjobs?.some(
          (subjob) => (subjob as { subjob_id?: string }).subjob_id === otE01RepairSubjob.subjob_id,
        ),
      ),
    ).toHaveLength(1);
    expect(EXECUTABLE_WORKFLOW_JOB_IDS).toHaveLength(5);
  });

  it('pins exact copy, sender, first-party CTA and suppression precedence', () => {
    for (const spec of executableWorkflowSpecs) {
      expect(spec.message.subject).not.toHaveLength(0);
      expect(spec.message.body).not.toHaveLength(0);
      expect(spec.message.cta.label).not.toHaveLength(0);
      expect(spec.sender.sender_key).toBe('brand');
      expect(spec.sender.reply_to.key).toBe('one_time_default_reply_to');
      expect(spec.message.cta.custom_value.key).toMatch(/^one_time_(signup|parent_portal)_url$/);
      expect(spec.suppression_precedence.join(' ')).toMatch(/DND/i);
      expect(spec.suppression_precedence.join(' ')).toMatch(/unsubscribe/i);
      expect(spec.suppression_precedence.join(' ')).toMatch(/complaint/i);
      expect(spec.suppression_precedence.join(' ')).toMatch(/hard bounce/i);
      expect(JSON.stringify(spec)).not.toMatch(/https?:\/\/(?:[^/]+\.)?(?:zoom\.us|vimeo\.com)/i);
      expect(spec.configuration_run).toEqual({
        messages_sent: 0,
        contacts_created: 0,
        contacts_enrolled: 0,
        broad_sends: 0,
      });
    }

    const invitation = executableWorkflowSpecs.find(
      (spec) => spec.workflow.canonical_key === 'OT-07',
    )!;
    expect(invitation.message.body).toMatch(/does not contain an activation/i);
    expect(invitation.forbidden_evidence_fields.join(' ')).toMatch(/password-reset token/i);

    const recording = executableWorkflowSpecs.find(
      (spec) => spec.workflow.canonical_key === 'OT-10',
    )!;
    expect(recording.message.cta.protected_reference_path).toBe('/app/parent');
    expect(recording.message.cta.custom_value.key).toBe('one_time_parent_portal_url');
    expect(JSON.stringify(recording)).not.toContain('one_time_recording_portal_url');
  });

  it('matches each application producer contract and dispatcher projection', async () => {
    const dispatcher = await text('packages/domain/src/highlevel/dispatcher.ts');
    const eventData = {
      'adult.signup.submitted': { signup_key: 'signup_test_01', classification: 'family' },
      'parent.portal.invitation_requested': {
        household_key: 'household_test_01',
        portal_status: 'invited',
      },
      'parent.portal.activated': {
        household_key: 'household_test_01',
        portal_status: 'active',
      },
      'class.reminder.requested': {
        household_key: 'household_test_01',
        occurrence_key: 'occurrence_test_01',
        starts_at: '2026-07-24T16:00:00.000Z',
        timezone: 'Asia/Jerusalem',
      },
      'recording.available': {
        household_key: 'household_test_01',
        content_item_key: 'content_test_01',
      },
    } as const;

    for (const spec of executableWorkflowSpecs) {
      const parsed = highLevelOutboundEventSchema.parse({
        contract_version: spec.application_contract.version,
        event_name: spec.application_contract.event_name,
        event_id: `event_${spec.job_id.toLowerCase()}`,
        idempotency_key: `idempotency_${spec.job_id.toLowerCase()}`,
        occurred_at: '2026-07-23T18:00:00.000Z',
        actor: { kind: 'system', reference: 'focused_test' },
        scope: {
          account_key: 'one_time',
          product_key: 'mishnayos',
          location_id: 'pBSnOK2nkdxp6gf9Rg3o',
        },
        adult_contact: { contact_key: 'adult_test_01', adult_only: true },
        consent: {
          email: 'granted',
          whatsapp: 'not_granted',
          suppression_state: 'active',
          email_dnd: false,
          whatsapp_dnd: false,
          policy_version: 'focused-test-v1',
          captured_at: '2026-07-23T17:59:00.000Z',
        },
        protected_reference: {
          kind: 'one_time_path',
          path: spec.message.cta.protected_reference_path,
        },
        data: eventData[spec.application_contract.event_name],
      });
      expect(parsed.adult_contact.adult_only).toBe(true);
      expect(dispatcher).toContain(
        `'${spec.application_contract.event_name}': '${spec.application_contract.trigger_tag.canonical_name}'`,
      );
      for (const field of spec.application_contract.projected_fields) {
        expect(dispatcher).toContain(field.ghl_id);
      }
    }
  });

  it('uses the accepted event-relative T-30 class contract', () => {
    expect(ONE_TIME_CLASS_START_HOUR * 60 + ONE_TIME_CLASS_START_MINUTE).toBe(19 * 60);
    expect(ONE_TIME_CLASS_REMINDER_HOUR * 60 + ONE_TIME_CLASS_REMINDER_MINUTE).toBe(18 * 60 + 30);
    const reminder = executableWorkflowSpecs.find(
      (spec) => spec.workflow.canonical_key === 'OT-09',
    )!;
    expect(
      reminder.ordered_steps.find((step) => step.kind === 'wait')?.exact_configuration,
    ).toMatch(/exactly 30 minutes before/i);
  });

  it('preserves PR 115 OT-E01 and OT-C01 observed truth', async () => {
    const result = await json<{
      preservedAssets: {
        'OT-E01': {
          id: string;
          observedStatus: string;
          publishedSwitchObserved: boolean;
          immediateConfirmationAction: string;
        };
        'OT-C01': {
          canonicalCampaign: {
            lastKnownStatus: string;
            selectedRecipients: number;
            sends: number;
          };
          sameNameWorkflowWrapper: { observedAfter: string; status: string };
        };
      };
    }>('integrations/highlevel/agent-mode/results/GHL-UI-14-18-20260723.result.json');

    expect(result.preservedAssets['OT-E01']).toMatchObject({
      id: otE01RepairSubjob.workflow.ghl_id,
      observedStatus: 'DRIFTED',
      publishedSwitchObserved: true,
      immediateConfirmationAction: 'disabled',
    });
    expect(result.preservedAssets['OT-C01'].canonicalCampaign).toMatchObject({
      lastKnownStatus: 'DRAFT_NOT_SENT',
      selectedRecipients: 0,
      sends: 0,
    });
    expect(result.preservedAssets['OT-C01'].sameNameWorkflowWrapper).toMatchObject({
      observedAfter: 'Draft',
      status: 'DRIFTED',
    });
    expect(otE01RepairSubjob.configuration_authority).toMatchObject({
      contacts_created: 0,
      contacts_enrolled: 0,
      messages_sent: 0,
      reenable_only_when_all_identity_controls_render: true,
    });
  });

  it('keeps the generated executable report deterministic', async () => {
    expect(
      compactReport(
        await text('integrations/highlevel/agent-mode/GHL-EXECUTABLE-WORKFLOW-REPORT.md'),
      ),
    ).toBe(compactReport(buildExecutableWorkflowReport()));
  });
});

function compactReport(value: string) {
  return value
    .split(/\r?\n/)
    .filter((line) => !/^\|\s*-+\s*\|/.test(line))
    .join('')
    .replace(/\s/g, '');
}

async function json<T = unknown>(filePath: string): Promise<T> {
  return JSON.parse(await text(filePath)) as T;
}

async function text(filePath: string) {
  return readFile(path.join(repoRoot, filePath), 'utf8');
}
