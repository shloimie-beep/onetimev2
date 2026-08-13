import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CommunicationsRoutingGuide } from '../../../apps/web/src/client/app/communications/CommunicationsFeature.tsx';

describe('Communications routing guide', () => {
  it('routes adult communications without exposing a local send action', () => {
    const html = renderToStaticMarkup(React.createElement(CommunicationsRoutingGuide));

    expect(html).toContain('Where communications work happens');
    expect(html).toContain('One Time Mishnayos &lt;info@onetimeonetime.com&gt;');
    expect(html).toContain('Rabbi Eli Scheller &lt;rabbielischeller@onetimeonetime.com&gt;');
    expect(html).toContain('href="/app/communications/OT-09"');
    expect(html).toContain('does not schedule or send reminders');
    expect(html).toContain('href="/app/tickets"');
    expect(html).toContain('Student support stays in One Time');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('mailto:');
  });
});
