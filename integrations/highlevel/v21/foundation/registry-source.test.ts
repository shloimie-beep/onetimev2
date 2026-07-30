import { describe, expect, it } from 'vitest';
import {
  botActionWorkflowRecords,
  businessWorkflowRecords,
  deprecatedWorkflowRecords,
} from '../../../../scripts/highlevel/workflow-registry-source.ts';

describe('P28 canonical workflow registry source', () => {
  it('reserves each canonical identifier to exactly one purpose without provider-ID reuse', () => {
    const records = [
      ...businessWorkflowRecords,
      ...botActionWorkflowRecords,
      ...deprecatedWorkflowRecords,
    ];
    const byKey = (key: string) => records.filter((record) => record.key === key);
    expect(byKey('OT-11')).toEqual([
      expect.objectContaining({
        canonicalName: 'OT-11 Retired / Reserved',
        objectType: 'deprecated_workflow',
        desiredStatus: 'BLOCKED',
        ghlId: '',
      }),
    ]);
    expect(byKey('OT-12')).toEqual([
      expect.objectContaining({
        canonicalName: 'OT-12 Adult Support Intake',
        objectType: 'business_workflow',
        ghlId: '',
      }),
    ]);
    expect(byKey('OT-14')).toEqual([
      expect.objectContaining({
        canonicalName: 'OT-14 Parent Newsletter',
        objectType: 'business_workflow',
        ghlId: '',
      }),
    ]);
    expect(byKey('OT-15')).toEqual([
      expect.objectContaining({
        canonicalName: 'OT-15 Former Member Reactivation',
        objectType: 'business_workflow',
        ghlId: '',
      }),
    ]);
    expect(byKey('OT-B01')).toEqual([
      expect.objectContaining({
        canonicalName: 'OT-B01 Website Lead-Capture Bot',
        objectType: 'bot_action_workflow',
        ghlId: '',
      }),
    ]);
  });
});
