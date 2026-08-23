import type { PortalViewState } from '../../features/portals/PortalFeatures.js';

export function shouldUseV21ParentChrome({
  role,
  sessionModel,
  viewState,
}: {
  role: 'parent' | 'student';
  sessionModel: 'legacy' | 'v21' | null;
  viewState: PortalViewState;
}) {
  if (role !== 'parent') return false;
  return sessionModel === 'v21' || (sessionModel === null && viewState === 'loading');
}
