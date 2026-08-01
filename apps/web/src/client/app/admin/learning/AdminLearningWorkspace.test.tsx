import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdminLearningWorkspace } from './AdminLearningWorkspace.tsx';

describe('P22 Admin learning workspace', () => {
  it('renders only the authenticated server projection', () => {
    const html = renderToStaticMarkup(
      <AdminLearningWorkspace questions={[]} announcements={[]} attendance={[]} />,
    );
    expect(html).toContain('Learning engagement');
    expect(html).toContain('Private Student questions');
    expect(html).not.toMatch(/vimeo|stripe|provider_account|consent mutation/iu);
  });
});
