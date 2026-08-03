import type { Express, Router } from 'express';
import type { AppConfig } from '../../../../../../packages/config/src/index.ts';
import type { DbPool } from '../../../../../../packages/db/src/index.ts';

export const SERVER_FEATURE_REGISTRY_CONTRACT_VERSION = '1.0.0' as const;

export type ServerFeatureContext = {
  config: AppConfig;
  pool: DbPool;
  distDir: string;
  clock?: (() => Date) | undefined;
};

export type ServerFeatureRegistration = {
  featureId: string;
  contractVersion: typeof SERVER_FEATURE_REGISTRY_CONTRACT_VERSION;
  mountPath: `/${string}`;
  createRouter: (context: ServerFeatureContext) => Router;
};

export type InstalledServerFeature = {
  featureId: string;
  mountPath: `/${string}`;
};

/**
 * The sole server composition seam for task-owned feature routers.
 *
 * Registrations are validated in full before any router is mounted so a
 * duplicate or malformed request cannot leave the application half-composed.
 */
export function installServerFeatureRouters(input: {
  app: Express;
  context: ServerFeatureContext;
  registrations?: readonly ServerFeatureRegistration[] | undefined;
}): readonly InstalledServerFeature[] {
  const registrations = [...(input.registrations ?? [])];
  validateServerFeatureRegistrations(registrations);

  return registrations.map((registration) => {
    input.app.use(registration.mountPath, registration.createRouter(input.context));
    return {
      featureId: registration.featureId,
      mountPath: registration.mountPath,
    };
  });
}

export function defineServerFeature(
  registration: ServerFeatureRegistration,
): ServerFeatureRegistration {
  validateServerFeatureRegistrations([registration]);
  return Object.freeze({ ...registration });
}

function validateServerFeatureRegistrations(
  registrations: readonly ServerFeatureRegistration[],
): void {
  const featureIds = new Set<string>();
  const mounts = new Set<string>();

  for (const registration of registrations) {
    if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u.test(registration.featureId)) {
      throw new Error(
        `Invalid server feature ID "${registration.featureId}"; use a namespaced lowercase ID.`,
      );
    }
    if (registration.contractVersion !== SERVER_FEATURE_REGISTRY_CONTRACT_VERSION) {
      throw new Error(
        `Server feature "${registration.featureId}" requires unsupported contract ${registration.contractVersion}.`,
      );
    }
    if (
      registration.mountPath !== '/' &&
      (registration.mountPath.endsWith('/') || registration.mountPath.includes('*'))
    ) {
      throw new Error(`Server feature "${registration.featureId}" has a non-canonical mount path.`);
    }
    if (featureIds.has(registration.featureId)) {
      throw new Error(`Duplicate server feature ID "${registration.featureId}".`);
    }
    if (mounts.has(registration.mountPath)) {
      throw new Error(`Duplicate server feature mount "${registration.mountPath}".`);
    }
    featureIds.add(registration.featureId);
    mounts.add(registration.mountPath);
  }
}
