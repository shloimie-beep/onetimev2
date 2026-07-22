import { describe, expect, it } from 'vitest';
import {
  botActionWorkflows,
  businessWorkflows,
  campaignAssets,
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
      pipelineDefinitions.filter((pipeline) => pipeline.status !== 'compatibility_alias'),
    ).toHaveLength(3);
    expect(eventDefinitions.map((event) => event.eventCode)).toEqual(['tisha-bav-2026']);
    const automationAssets = [...businessWorkflows, ...botActionWorkflows];
    expect(automationAssets).toHaveLength(19);
    expect(automationAssets.filter((asset) => asset.asset_kind === 'workflow')).toHaveLength(18);
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
  });
});
