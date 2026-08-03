import React from 'react';
import {
  ParentPortalFeature,
  StudentPortalFeature,
  type ParentPortalFeatureProps,
  type StudentPortalFeatureProps,
} from '../../features/portals/PortalFeatures.js';

export type ParentClientRootProps = ParentPortalFeatureProps;
export type StudentClientRootProps = StudentPortalFeatureProps;

export function ParentClientRoot(props: ParentClientRootProps) {
  return <ParentPortalFeature {...props} />;
}

export function StudentClientRoot(props: StudentClientRootProps) {
  return <StudentPortalFeature {...props} />;
}
