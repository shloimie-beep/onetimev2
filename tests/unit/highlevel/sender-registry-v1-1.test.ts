import { describe, expect, it } from 'vitest';
import {
  botActionWorkflows,
  businessWorkflows,
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
    expect([...businessWorkflows, ...botActionWorkflows]).toHaveLength(19);
    expect(
      [...businessWorkflows, ...botActionWorkflows].every(
        (workflow) => workflow.senderKey && workflow.messageClass && workflow.exactTrigger,
      ),
    ).toBe(true);
  });
});
