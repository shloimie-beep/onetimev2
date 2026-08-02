import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

async function readRepoFile(filePath: string) {
  return (await readFile(path.join(repoRoot, filePath), 'utf8')).replace(/\r\n/g, '\n');
}

describe('Rabbi launch email design', () => {
  it('keeps OT-02A and OT-02B in separate permission-bound delivery contracts with the fixed sender', async () => {
    const [registry, senderRegistry, migrationPrompt, nurturePrompt] = await Promise.all([
      readRepoFile('integrations/highlevel/registry/workflow-registry.yaml'),
      readRepoFile('integrations/highlevel/registry/sender-registry.yaml'),
      readRepoFile(
        'integrations/highlevel/ai-workflow-prompts/OT-02A-existing-subscriber-migration-2026-v1.md',
      ),
      readRepoFile('integrations/highlevel/ai-workflow-prompts/OT-02B-new-lead-nurture-v1.md'),
    ]);

    expect(registry).toContain(
      "reviewed_email_one_identity: 'ghl.legacy_member_migration.step_1.v1'",
    );
    expect(registry).toContain(
      "reviewed_email_two_identity: 'ghl.legacy_member_migration.step_2.v1'",
    );
    expect(registry).toContain(
      "reviewed_email_three_identity: 'ghl.legacy_member_migration.step_3.v1'",
    );
    expect(registry).toContain('workflow_draft_unpublished_inactive_unenrolled: true');
    expect(registry).toContain("reviewed_email_one_identity: 'ghl.prelaunch_nurture.step_1.v1'");
    expect(registry).toContain(
      "canonical_public_rabbi_identity: 'Rabbi Eli Scheller <rabbielischeller@onetimeonetime.com>'",
    );
    expect(registry).toContain("sender_decision_status: 'fixed; not an operator decision gate'");
    expect(registry).toContain(
      "sender_acceptance_job: 'GHL-UI-24-rabbi-campaign-one-seed-reply-acceptance'",
    );
    expect(senderRegistry).toContain("displayName: 'Rabbi Eli Scheller'");
    expect(senderRegistry).toContain("fromEmail: 'rabbielischeller@onetimeonetime.com'");
    expect(senderRegistry).toContain("replyTo: 'rabbielischeller@onetimeonetime.com'");
    expect(senderRegistry).toContain("historicalAliases:\n    - 'rabbi@onetimeonetime.com'");
    expect(migrationPrompt).toContain('operator-selected adult existing-subscriber migration list');
    expect(migrationPrompt).toContain('Event-specific permission never permits this sequence.');
    expect(migrationPrompt).toContain('Subject: A new zman for One Time Mishnayos');
    expect(migrationPrompt).toContain(
      '## Reviewed Email Two - `ghl.legacy_member_migration.step_2.v1`',
    );
    expect(migrationPrompt).toContain(
      'One Time combines live learning with an on-demand recording library',
    );
    expect(migrationPrompt).toContain(
      '## Reviewed Email Three - `ghl.legacy_member_migration.step_3.v1`',
    );
    expect(migrationPrompt).toContain(
      'Your family can begin with immediate free access and add up to three Student seats',
    );
    expect(migrationPrompt).not.toMatch(/controlled pilot|pilot information/i);
    expect(migrationPrompt).toContain(
      'Keep the workflow Draft, unpublished, inactive, and unenrolled.',
    );
    expect(migrationPrompt).toContain(
      'Use the standard GHL unsubscribe treatment on all three emails.',
    );
    expect(nurturePrompt).toContain('independently proven general-marketing permission');
    expect(nurturePrompt).toContain(
      'Event registration, attendance, payment, portal state, deliverability, and legacy tags never establish permission.',
    );
    for (const prompt of [migrationPrompt, nurturePrompt]) {
      expect(prompt).toContain('rabbielischeller@onetimeonetime.com');
      expect(prompt).toContain('One Time Rabbi Campaign Phase 2 From');
      expect(prompt).toContain('One Time Rabbi Reply-To');
      expect(prompt).toContain('GHL-UI-24');
      expect(prompt).toContain('rabbi@onetimeonetime.com');
      expect(prompt).toContain('One Time Home URL');
      expect(prompt).toContain('This copy is not authorization to send.');
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
    expect(successorText).toContain('The sender product decision is fixed');
    expect(successorText).toContain('Rabbi Eli Scheller <rabbielischeller@onetimeonetime.com>');
    expect(successorText).toContain('historical rabbi@');
    expect(successorText).not.toContain(
      'Rabbi Eli Scheller | One Time Mishnayos <rabbi@onetimeonetime.com>',
    );
    expect(successorText).toContain('APPROVE SEND for exactly one seed');
    expect(successorText).not.toContain('approval to use rabbi@');
  });
});
