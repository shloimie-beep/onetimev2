import { describe, expect, it } from 'vitest';

import { contentWorkspaceRouteFromPath } from './ContentWorkspace.tsx';

describe('content workspace media route', () => {
  it('composes the canonical upload route without changing deployed content routes', () => {
    expect(contentWorkspaceRouteFromPath('/app/content/upload')).toEqual({ kind: 'ingest' });
    expect(contentWorkspaceRouteFromPath('/app/content')).toEqual({ kind: 'overview' });
    expect(contentWorkspaceRouteFromPath('/app/content/publication')).toEqual({
      kind: 'publication',
    });
    expect(contentWorkspaceRouteFromPath('/app/content/processing')).toEqual({
      kind: 'processing',
    });
  });
});
