import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CommunicationsFeature } from '../../../apps/web/src/client/app/communications/CommunicationsFeature.tsx';

describe('Communications active-account delivery history view', () => {
  it('presents only One Time account lifecycle filters without GHL routing or lead UI', () => {
    const html = renderToStaticMarkup(React.createElement(CommunicationsFeature));

    expect(html).toContain('Active One Time accounts');
    expect(html).toContain('password-reset');
    expect(html).toContain('Student PIN reset');
    expect(html).toContain('Loading account delivery history');
    expect(html).not.toContain('GHL');
    expect(html).not.toContain('routing');
    expect(html).not.toContain('lead');
    expect(html).not.toContain('WhatsApp');
    expect(html).not.toContain('View contact');
  });
});
