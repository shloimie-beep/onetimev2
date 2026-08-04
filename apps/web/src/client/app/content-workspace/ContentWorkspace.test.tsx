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

  it('does not project media control query values into route or browser state', () => {
    const route = contentWorkspaceRouteFromPath(
      '/app/content/upload?media_authorization_id=browser-auth-sentinel&media_canary_id=browser-canary-sentinel',
    );

    expect(route).toEqual({ kind: 'ingest' });
    expect(JSON.stringify(route)).not.toMatch(/browser-auth-sentinel|browser-canary-sentinel/u);
  });
});
