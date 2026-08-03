import { describe, expect, it } from 'vitest';
import {
  botActionWorkflows,
  businessWorkflows,
  campaignAssets,
  customValues,
  eventDefinitions,
  messageClasses,
  pipelineDefinitions,
  registryMetadata,
  senderProfiles,
} from '../../../scripts/highlevel/canonical-registry-data.ts';

describe('HighLevel sender registry 1.1', () => {
  it('pins senders, message classes, pipelines, events, and exact workflow triggers', () => {
    expect(registryMetadata).toMatchObject({
      schemaId: 'one-time-highlevel',
      schemaVersion: '1.1.0',
      status: 'active',
    });
    expect(senderProfiles).toHaveLength(5);
    expect(messageClasses).toHaveLength(35);
    expect(
      senderProfiles.filter(
        (sender) => sender.key === 'rabbi_campaign' || sender.key === 'rabbi_personal',
      ),
    ).toEqual([
      expect.objectContaining({
        key: 'rabbi_campaign',
        displayName: 'Rabbi Eli Scheller',
        fromEmail: 'rabbielischeller@onetimeonetime.com',
        replyTo: 'rabbielischeller@onetimeonetime.com',
        historicalAliases: ['rabbi@onetimeonetime.com'],
      }),
      expect.objectContaining({
        key: 'rabbi_personal',
        displayName: 'Rabbi Eli Scheller',
        fromEmail: 'rabbielischeller@onetimeonetime.com',
        replyTo: 'rabbielischeller@onetimeonetime.com',
        historicalAliases: ['rabbi@onetimeonetime.com'],
      }),
    ]);
    expect(
      customValues.find((value) => value.canonicalName === 'One Time Rabbi Reply-To'),
    ).toMatchObject({
      value: 'rabbielischeller@onetimeonetime.com',
      deprecationState: 'pending_creation',
    });
    expect(
      pipelineDefinitions.filter((pipeline) => pipeline.status !== 'compatibility_alias'),
    ).toHaveLength(3);
    expect(eventDefinitions.map((event) => event.eventCode)).toEqual(['tisha-bav-2026']);
    const automationAssets = [...businessWorkflows, ...botActionWorkflows];
    expect(automationAssets).toHaveLength(23);
    expect(automationAssets.filter((asset) => asset.asset_kind === 'workflow')).toHaveLength(22);
    expect(campaignAssets).toHaveLength(1);
    expect(campaignAssets[0]).toMatchObject({
      key: 'OT-C01',
      asset_kind: 'email_marketing_campaign',
      observedStatus: 'SAVED_REOPENED',
      audienceReadback: { audienceConfigured: false, scheduled: false, sends: 0 },
    });
    expect(
      automationAssets.every(
        (workflow) => workflow.senderKey && workflow.messageClass && workflow.exactTrigger,
      ),
    ).toBe(true);
    expect(
      automationAssets
        .filter((workflow) => ['OT-08', 'OT-09', 'OT-10'].includes(workflow.key))
        .map((workflow) => [workflow.key, workflow.senderKey]),
    ).toEqual([
      ['OT-08', 'brand'],
      ['OT-09', 'brand'],
      ['OT-10', 'brand'],
    ]);
    expect(automationAssets.find((workflow) => workflow.key === 'OT-16')).toMatchObject({
      canonicalName: 'OT-16 Free-Period Conversion',
      senderKey: 'office',
      messageClass: 'billing_help',
      observedStatus: 'MISSING',
      desiredStatus: 'DRAFT_WAITING_EXTERNAL',
    });
  });
});
