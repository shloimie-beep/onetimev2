const loadCommunicationsFeature = () => import('./CommunicationsFeature.tsx');

export const communicationsRouteDescriptor = {
  id: 'communications',
  path: '/app/communications',
  label: 'Communications',
  allowedRoles: ['owner', 'admin'],
  load: loadCommunicationsFeature,
} as const;

export const contactCommunicationsTabDescriptor = {
  id: 'communications',
  label: 'Communications',
  allowedRoles: ['owner', 'admin'],
  load: loadCommunicationsFeature,
} as const;
