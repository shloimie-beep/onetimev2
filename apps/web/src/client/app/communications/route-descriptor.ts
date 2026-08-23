const loadCommunicationsFeature = () => import('./CommunicationsFeature.tsx');

export const communicationsRouteDescriptor = {
  id: 'communications',
  path: '/app/communications',
  label: 'Communications',
  allowedRoles: ['owner', 'admin'],
  load: loadCommunicationsFeature,
} as const;
