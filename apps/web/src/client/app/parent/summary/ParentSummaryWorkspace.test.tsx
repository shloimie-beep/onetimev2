import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ParentHouseholdApi } from '../household/api.ts';
import { ParentSummaryWorkspace } from './ParentSummaryWorkspace.tsx';

describe('v2.1 Parent summary workspace', () => {
  it('renders a bounded loading state before the private summary resolves', () => {
    const api = {
      loadSummary: () => new Promise(() => undefined),
    } as unknown as ParentHouseholdApi;
    const html = renderToStaticMarkup(
      <ParentSummaryWorkspace view={{ kind: 'calendar' }} api={api} />,
    );
    expect(html).toContain('Loading Parent summary');
    expect(html).not.toMatch(/join_url|recording|private question/i);
  });
});
