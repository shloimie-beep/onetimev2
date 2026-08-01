import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PublicationWorkspace } from './PublicationWorkspace.tsx';

describe('P21 Admin publication workspace', () => {
  it('renders only the approved-projection entry boundary before a record is loaded', () => {
    const html = renderToStaticMarkup(
      <PublicationWorkspace csrfToken="csrf-test" onProtectedStateCleared={() => undefined} />,
    );
    expect(html).toContain('Publication');
    expect(html).toContain('Register approved projection');
    expect(html).not.toMatch(/vimeo|provider[_ -]?asset|approval evidence|https?:\/\//iu);
  });
});
