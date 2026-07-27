import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

async function readRepoFile(filePath: string) {
  return readFile(path.join(repoRoot, filePath), 'utf8');
}

describe('Rabbi launch email design', () => {
  it('keeps OT-02A and OT-02B in separate Phase-1, permission-bound delivery contracts', async () => {
    const [registry, migrationPrompt, nurturePrompt] = await Promise.all([
      readRepoFile('integrations/highlevel/registry/workflow-registry.yaml'),
      readRepoFile(
        'integrations/highlevel/ai-workflow-prompts/OT-02A-existing-subscriber-migration-2026-v1.md',
      ),
      readRepoFile('integrations/highlevel/ai-workflow-prompts/OT-02B-new-lead-nurture-v1.md'),
    ]);

    expect(registry).toContain(
      "reviewed_email_one_identity: 'rabbi_new_program_existing_subscriber_migration_v1'",
    );
    expect(registry).toContain(
      "reviewed_email_one_identity: 'rabbi_new_program_prelaunch_nurture_v1'",
    );
    expect(registry).toContain("phase_1_from: 'info@onetimeonetime.com only'");
    expect(registry).toContain(
      "phase_2_acceptance_job: 'GHL-UI-24-rabbi-campaign-one-seed-reply-acceptance'",
    );
    expect(migrationPrompt).toContain('operator-selected adult existing-subscriber migration list');
    expect(migrationPrompt).toContain('Tisha event permission is event-purpose only');
    expect(nurturePrompt).toContain('independently proven general-marketing permission');
    expect(nurturePrompt).toContain(
      'Tisha registration, attendance, payment, portal state, deliverability, and legacy tags never establish that permission',
    );
    for (const prompt of [migrationPrompt, nurturePrompt]) {
      expect(prompt).toContain('One Time Rabbi Campaign Phase 1 From');
      expect(prompt).toContain('Do not select One Time Rabbi Campaign Phase 2 From');
      expect(prompt).toContain('One Time Home URL');
      expect(prompt).toContain('This copy is not an authorization to send.');
    }
  });

  it('keeps GHL-UI-13 zero-send and gates the sole successor to one protected seed and reply', async () => {
    const [phaseTwo, successorText] = await Promise.all([
      readRepoFile(
        'integrations/highlevel/agent-mode/jobs/GHL-UI-13-phase-2-rabbi-acceptance.json',
      ),
      readRepoFile(
        'integrations/highlevel/agent-mode/jobs/GHL-UI-24-rabbi-campaign-one-seed-reply-acceptance.json',
      ),
    ]);
    const phaseTwoJob = JSON.parse(phaseTwo) as { defaults: { no_send: boolean } };
    const successor = JSON.parse(successorText) as {
      job_id: string;
      defaults: {
        maximum_messages_sent: number;
        no_publish: boolean;
        no_contact_mutation: boolean;
      };
      result_json_schema: {
        properties: { messages_sent: { enum: number[] }; contacts_changed: { const: number } };
      };
    };

    expect(phaseTwoJob.defaults.no_send).toBe(true);
    expect(successor.job_id).toBe('GHL-UI-24');
    expect(successor.defaults).toMatchObject({
      maximum_messages_sent: 1,
      no_publish: true,
      no_contact_mutation: true,
    });
    expect(successor.result_json_schema.properties.messages_sent.enum).toEqual([0, 1]);
    expect(successor.result_json_schema.properties.contacts_changed.const).toBe(0);
    expect(successorText).toContain(
      'This is a separately gated job. It is BLOCKED with zero effects unless',
    );
  });
});
