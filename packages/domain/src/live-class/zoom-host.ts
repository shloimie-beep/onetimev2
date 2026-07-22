import type { AppConfig } from '../../../config/src/index.ts';
import type { ZoomHostLaunchPort } from './service.ts';
import {
  createHostZoomSdkSignature,
  createLearnerZoomSdkSignature,
  createZoomRestClient,
} from '../providers/zoom-rest.ts';

export const ZOOM_HOST_CONTROL_PROVIDER_GATE_VARIABLES = [
  'ONE_TIME_RUNTIME_ENVIRONMENT',
  'ZOOM_CLASSROOM_ENABLED',
  'ZOOM_CLASSROOM_PROVIDER_MODE',
  'ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED',
] as const;

export const ZOOM_HOST_CONTROL_READINESS_VARIABLES = [
  'ZOOM_MEETING_SDK_CLIENT_ID',
  'ZOOM_MEETING_SDK_CLIENT_SECRET',
  'ZOOM_MEETING_SDK_WEB_VERSION',
  'ZOOM_ACCOUNT_ID',
  'ZOOM_S2S_CLIENT_ID',
  'ZOOM_S2S_CLIENT_SECRET',
  'ZOOM_HOST_USER_ID',
  'ZOOM_REAL_CONTROL_MEETING_ID',
  'ZOOM_REAL_CONTROL_MEETING_PASSCODE',
] as const;

export const ZOOM_HOST_CONTROL_REQUIRED_VARIABLES = [
  ...ZOOM_HOST_CONTROL_PROVIDER_GATE_VARIABLES,
  ...ZOOM_HOST_CONTROL_READINESS_VARIABLES,
] as const;

export type ZoomHostControlProviderGate =
  (typeof ZOOM_HOST_CONTROL_PROVIDER_GATE_VARIABLES)[number];
export type ZoomHostControlReadinessVariable =
  (typeof ZOOM_HOST_CONTROL_READINESS_VARIABLES)[number];
export type ZoomHostControlReadiness = {
  ready: boolean;
  code: 'ZOOM_HOST_CONTROL_READY' | 'PROVIDER_OFF' | 'PROVIDER_NOT_READY';
  provider_gate_blockers: ZoomHostControlProviderGate[];
  readiness_blockers: ZoomHostControlReadinessVariable[];
  secret_values_included: false;
};

type ZoomZakPort = {
  getHostZakToken(hostUserId: string): Promise<string>;
};

export type ZoomHostLaunchDependencies = {
  createRestClient?: (options: Parameters<typeof createZoomRestClient>[0]) => ZoomZakPort;
  createHostSignature?: typeof createHostZoomSdkSignature;
  createLearnerSignature?: typeof createLearnerZoomSdkSignature;
};

export function inspectZoomHostControlReadiness(config: AppConfig): ZoomHostControlReadiness {
  const providerGateBlockers: ZoomHostControlProviderGate[] = [];
  const readinessBlockers: ZoomHostControlReadinessVariable[] = [];

  if (config.oneTimeRuntimeEnvironment !== 'isolated_staging') {
    providerGateBlockers.push('ONE_TIME_RUNTIME_ENVIRONMENT');
  }
  if (!config.zoomClassroomEnabled) {
    providerGateBlockers.push('ZOOM_CLASSROOM_ENABLED');
  }
  if (config.zoomClassroomProviderMode !== 'real') {
    providerGateBlockers.push('ZOOM_CLASSROOM_PROVIDER_MODE');
  }
  if (!config.zoomClassroomRealProviderEnabled) {
    providerGateBlockers.push('ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED');
  }

  if (!config.zoomMeetingSdkCanonicalClientIdConfigured) {
    readinessBlockers.push('ZOOM_MEETING_SDK_CLIENT_ID');
  }
  if (!config.zoomMeetingSdkCanonicalClientSecretConfigured) {
    readinessBlockers.push('ZOOM_MEETING_SDK_CLIENT_SECRET');
  }
  if (!config.zoomMeetingSdkWebVersionConfigured) {
    readinessBlockers.push('ZOOM_MEETING_SDK_WEB_VERSION');
  }
  if (!hasValue(config.zoomAccountId)) readinessBlockers.push('ZOOM_ACCOUNT_ID');
  if (!hasValue(config.zoomServerToServerClientId)) {
    readinessBlockers.push('ZOOM_S2S_CLIENT_ID');
  }
  if (!hasValue(config.zoomServerToServerClientSecret)) {
    readinessBlockers.push('ZOOM_S2S_CLIENT_SECRET');
  }
  if (!hasValue(config.zoomHostUserId)) readinessBlockers.push('ZOOM_HOST_USER_ID');
  if (!hasValue(config.zoomRealControlMeetingId)) {
    readinessBlockers.push('ZOOM_REAL_CONTROL_MEETING_ID');
  }
  if (!hasValue(config.zoomRealControlMeetingPasscode)) {
    readinessBlockers.push('ZOOM_REAL_CONTROL_MEETING_PASSCODE');
  }

  return {
    ready: providerGateBlockers.length === 0 && readinessBlockers.length === 0,
    code:
      providerGateBlockers.length > 0
        ? 'PROVIDER_OFF'
        : readinessBlockers.length > 0
          ? 'PROVIDER_NOT_READY'
          : 'ZOOM_HOST_CONTROL_READY',
    provider_gate_blockers: providerGateBlockers,
    readiness_blockers: readinessBlockers,
    secret_values_included: false,
  };
}

export function createZoomHostLaunchPort(
  config: AppConfig,
  dependencies: ZoomHostLaunchDependencies = {},
): ZoomHostLaunchPort | undefined {
  if (!inspectZoomHostControlReadiness(config).ready) return undefined;

  const sdkKey = config.zoomMeetingSdkClientId!;
  const sdkSecret = config.zoomMeetingSdkClientSecret!;
  const accountId = config.zoomAccountId!;
  const clientId = config.zoomServerToServerClientId!;
  const clientSecret = config.zoomServerToServerClientSecret!;
  const hostUserId = config.zoomHostUserId!;
  const meetingNumber = config.zoomRealControlMeetingId!;
  const password = config.zoomRealControlMeetingPasscode!;
  const hostSignature = dependencies.createHostSignature ?? createHostZoomSdkSignature;
  const learnerSignature = dependencies.createLearnerSignature ?? createLearnerZoomSdkSignature;

  const rest = (dependencies.createRestClient ?? createZoomRestClient)({
    credentials: { accountId, clientId, clientSecret },
    environment: config.oneTimeRuntimeEnvironment === 'production' ? 'production' : 'staging',
    enabled: true,
  });

  return {
    async resolveHostLaunch({ occurrenceKey, now }) {
      const [signature, zak] = await Promise.all([
        Promise.resolve(
          hostSignature({
            credentials: { sdkKey, sdkSecret },
            meetingNumber,
            issuedAt: now,
            ttlSeconds: 30 * 60,
          }),
        ),
        rest.getHostZakToken(hostUserId),
      ]);
      return {
        occurrence_key: occurrenceKey,
        sdk_web_version: config.zoomMeetingSdkWebVersion,
        meeting_number: meetingNumber,
        signature,
        password,
        zak,
        user_name: 'One Time Zoom Stage Host',
        leave_url: '/app/live-console',
        video_start_model: 'PARTICIPANT_CONSENT',
      };
    },
    async resolveTestParticipantLaunch({ occurrenceKey, customerKey, userName, now }) {
      return {
        occurrence_key: occurrenceKey,
        sdk_web_version: config.zoomMeetingSdkWebVersion,
        meeting_number: meetingNumber,
        signature: learnerSignature({
          credentials: { sdkKey, sdkSecret },
          meetingNumber,
          issuedAt: now,
          ttlSeconds: 30 * 60,
        }),
        password,
        customer_key: customerKey,
        user_name: userName,
        leave_url: '/app/live-console',
        video_start_model: 'PARTICIPANT_CONSENT',
      };
    },
  };
}

function hasValue(value: string | undefined) {
  return typeof value === 'string' && value.trim().length > 0;
}
