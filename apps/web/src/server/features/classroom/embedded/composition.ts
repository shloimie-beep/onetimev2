import type {
  AttendanceProjectionChangePort,
  EmbeddedClassroomRepository,
  EmbeddedJoinContextResolver,
  MeetingSdkBootstrapPort,
} from '../../../../../../../packages/contracts/src/classroom/embedded/index.ts';
import { createPostgresEmbeddedClassroomRepository } from '../../../../../../../packages/db/src/classroom/attendance/repository.ts';
import type { EmbeddedClassroomSqlPool } from '../../../../../../../packages/db/src/classroom/attendance/repository.ts';
import {
  SERVER_FEATURE_REGISTRY_CONTRACT_VERSION,
  type ServerFeatureRegistration,
} from '../../registry/index.ts';
import type {
  AdminAttendanceRecordReader,
  AdminAttendanceSubjectResolver,
  EmbeddedClassroomRequestIdentityResolver,
  VerifiedProviderAttendanceResolver,
} from './adapters.ts';
import {
  createUnavailableAdminAttendanceRecordReader,
  createUnavailableAdminAttendanceSubjectResolver,
  createUnavailableEmbeddedJoinContextResolver,
  createUnavailableMeetingSdkBootstrapPort,
  createUnavailableProviderAttendanceResolver,
} from './adapters.ts';
import { createEmbeddedClassroomRouter } from './router.ts';
import { createEmbeddedClassroomService } from './service.ts';

export const EMBEDDED_CLASSROOM_FEATURE_ID = 'onetime.embedded-classroom' as const;
export const EMBEDDED_CLASSROOM_MOUNT_PATH = '/api/app/classroom' as const;

declare const installedReceiptBrand: unique symbol;
export type EmbeddedClassroomInstalledRuntimeReceipt = Readonly<{
  feature_id: typeof EMBEDDED_CLASSROOM_FEATURE_ID;
  mount_path: typeof EMBEDDED_CLASSROOM_MOUNT_PATH;
  contract_version: typeof SERVER_FEATURE_REGISTRY_CONTRACT_VERSION;
  [installedReceiptBrand]: true;
}>;

const installedReceipts = new WeakSet<object>();

export type EmbeddedClassroomCandidateRuntime = {
  contextResolver?: EmbeddedJoinContextResolver;
  sdkBootstrap?: MeetingSdkBootstrapPort;
  providerAttendance?: VerifiedProviderAttendanceResolver;
  adminAttendanceRecords?: AdminAttendanceRecordReader;
  adminAttendanceSubjects?: AdminAttendanceSubjectResolver;
};

export type EmbeddedClassroomFeatureComposition = {
  registration: ServerFeatureRegistration;
  readInstalledReceipt(): EmbeddedClassroomInstalledRuntimeReceipt | null;
};

export function createEmbeddedClassroomFeatureComposition(input: {
  attendanceProjectionChanges: AttendanceProjectionChangePort;
  identities: EmbeddedClassroomRequestIdentityResolver;
  candidateRuntime?: EmbeddedClassroomCandidateRuntime;
  repositoryFactory?: (
    pool: EmbeddedClassroomSqlPool,
    changes: AttendanceProjectionChangePort,
  ) => EmbeddedClassroomRepository;
}): EmbeddedClassroomFeatureComposition {
  let installedReceipt: EmbeddedClassroomInstalledRuntimeReceipt | null = null;
  let constructed = false;

  const registration: ServerFeatureRegistration = {
    featureId: EMBEDDED_CLASSROOM_FEATURE_ID,
    contractVersion: SERVER_FEATURE_REGISTRY_CONTRACT_VERSION,
    mountPath: EMBEDDED_CLASSROOM_MOUNT_PATH,
    createRouter(context) {
      if (constructed) throw new Error('embedded_classroom_runtime_already_constructed');
      constructed = true;
      const repository = (input.repositoryFactory ?? createPostgresEmbeddedClassroomRepository)(
        context.pool,
        input.attendanceProjectionChanges,
      );
      const service = createEmbeddedClassroomService({
        repository,
        context_resolver:
          input.candidateRuntime?.contextResolver ?? createUnavailableEmbeddedJoinContextResolver(),
        sdk_bootstrap:
          input.candidateRuntime?.sdkBootstrap ?? createUnavailableMeetingSdkBootstrapPort(),
      });
      const router = createEmbeddedClassroomRouter({
        service,
        identities: input.identities,
        providerAttendance:
          input.candidateRuntime?.providerAttendance ??
          createUnavailableProviderAttendanceResolver(),
        adminAttendanceSubjects:
          input.candidateRuntime?.adminAttendanceSubjects ??
          createUnavailableAdminAttendanceSubjectResolver(),
        adminAttendanceRecords:
          input.candidateRuntime?.adminAttendanceRecords ??
          createUnavailableAdminAttendanceRecordReader(),
        ...(context.clock ? { clock: context.clock } : {}),
      });
      const receipt = Object.freeze({
        feature_id: EMBEDDED_CLASSROOM_FEATURE_ID,
        mount_path: EMBEDDED_CLASSROOM_MOUNT_PATH,
        contract_version: SERVER_FEATURE_REGISTRY_CONTRACT_VERSION,
      }) as EmbeddedClassroomInstalledRuntimeReceipt;
      installedReceipts.add(receipt);
      installedReceipt = receipt;
      return router;
    },
  };

  return {
    registration,
    readInstalledReceipt: () => installedReceipt,
  };
}

export function isEmbeddedClassroomInstalledRuntimeReceipt(
  value: unknown,
): value is EmbeddedClassroomInstalledRuntimeReceipt {
  return typeof value === 'object' && value !== null && installedReceipts.has(value);
}
