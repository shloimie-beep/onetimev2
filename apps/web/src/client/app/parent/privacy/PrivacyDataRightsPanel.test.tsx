import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PrivacyDataRightsPanel } from './PrivacyDataRightsPanel.tsx';

describe('privacy data-rights panel', () => {
  it('keeps consent scopes and closure/erasure actions visibly separate', () => {
    const html = renderToStaticMarkup(
      <PrivacyDataRightsPanel
        actorKind="parent"
        consents={[
          {
            scope: 'recording_participation',
            label: 'Recorded class participation',
            required: true,
            granted: false,
            policy_version: 'recording-v1',
            evidence_at: null,
            consequence_preview: 'Without this choice, future recorded-class joins remain blocked.',
            can_change: true,
          },
          {
            scope: 'member_recognition',
            label: 'Member recognition',
            required: false,
            granted: false,
            policy_version: 'recognition-v1',
            evidence_at: null,
            consequence_preview: 'Peers see a stable class alias; rank remains unchanged.',
            can_change: true,
          },
        ]}
        requests={[]}
        onConsentChange={vi.fn()}
        onCreateRequest={vi.fn()}
      />,
    );
    expect(html).toContain('Private Student question and support bodies are not included');
    expect(html).toContain('Request account closure');
    expect(html).toContain('Request verified erasure');
    expect(html.match(/type="checkbox"/g)).toHaveLength(2);
  });
});
