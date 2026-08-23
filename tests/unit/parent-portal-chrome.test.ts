import { describe, expect, it } from 'vitest';
import { shouldUseV21ParentChrome } from '../../apps/web/src/client/app/parent/parent-shell-state.ts';

describe('Parent portal chrome', () => {
  it('uses the final Parent chrome during session resolution and for v2.1 sessions', () => {
    expect(
      shouldUseV21ParentChrome({
        role: 'parent',
        sessionModel: null,
        viewState: 'loading',
      }),
    ).toBe(true);
    expect(
      shouldUseV21ParentChrome({
        role: 'parent',
        sessionModel: 'v21',
        viewState: 'ready',
      }),
    ).toBe(true);
  });

  it('does not replace a resolved legacy or Student shell', () => {
    expect(
      shouldUseV21ParentChrome({
        role: 'parent',
        sessionModel: 'legacy',
        viewState: 'ready',
      }),
    ).toBe(false);
    expect(
      shouldUseV21ParentChrome({
        role: 'student',
        sessionModel: null,
        viewState: 'loading',
      }),
    ).toBe(false);
  });
});
