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

export const ZOOM_MEETING_SDK_APP_VARIABLES = [
  'ZOOM_MEETING_SDK_CLIENT_ID',
  'ZOOM_MEETING_SDK_CLIENT_SECRET',
  'ZOOM_MEETING_SDK_ALLOWED_ORIGIN',
  'ZOOM_MEETING_SDK_WEB_VERSION',
] as const;

export const ZOOM_S2S_MEETING_PROVISIONING_VARIABLES = [
  'ZOOM_S2S_ACCOUNT_ID',
  'ZOOM_S2S_CLIENT_ID',
  'ZOOM_S2S_CLIENT_SECRET',
  'ZOOM_REAL_CONTROL_MEETING_ID',
  'ZOOM_REAL_CONTROL_MEETING_PASSCODE',
] as const;

export const ZOOM_HOST_AUTHORIZATION_VARIABLES = ['ZOOM_HOST_USER_ID'] as const;

export const ZOOM_REAL_CONTROL_CANARY_AUTHORIZATION_VARIABLES = [
  'ZOOM_CLASSROOM_CANARY_ENABLED',
  'ZOOM_CLASSROOM_CANARY_LEARNER_KEY',
] as const;

export const ZOOM_HOST_CONTROL_READINESS_VARIABLES = [
  ...ZOOM_MEETING_SDK_APP_VARIABLES,
  ...ZOOM_S2S_MEETING_PROVISIONING_VARIABLES,
  ...ZOOM_HOST_AUTHORIZATION_VARIABLES,
] as const;

export const ZOOM_HOST_CONTROL_REQUIRED_VARIABLES = [
  ...ZOOM_HOST_CONTROL_PROVIDER_GATE_VARIABLES,
  ...ZOOM_HOST_CONTROL_READINESS_VARIABLES,
  ...ZOOM_REAL_CONTROL_CANARY_AUTHORIZATION_VARIABLES,
] as const;

export type ZoomHostControlProviderGate =
  (typeof ZOOM_HOST_CONTROL_PROVIDER_GATE_VARIABLES)[number];
export type ZoomHostControlReadinessVariable =
  (typeof ZOOM_HOST_CONTROL_READINESS_VARIABLES)[number];
export type ZoomRealControlCanaryAuthorizationVariable =
  (typeof ZOOM_REAL_CONTROL_CANARY_AUTHORIZATION_VARIABLES)[number];
export type ZoomHostControlReadinessPhase = {
  ready: boolean;
  blocker_variable_names: string[];
};
export type ZoomHostControlReadiness = {
  ready: boolean;
  code: 'ZOOM_HOST_CONTROL_READY' | 'PROVIDER_OFF' | 'PROVIDER_NOT_READY';
  provider_gate_blockers: ZoomHostControlProviderGate[];
  readiness_blockers: ZoomHostControlReadinessVariable[];
  canary_authorization_blockers: ZoomRealControlCanaryAuthorizationVariable[];
  phases: {
    sdk_app: ZoomHostControlReadinessPhase;
    s2s_meeting_provisioning: ZoomHostControlReadinessPhase;
    host_authorization: ZoomHostControlReadinessPhase;
    real_control_canary_authorization: ZoomHostControlReadinessPhase;
  };
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
  const sdkAppBlockers: ZoomHostControlReadinessVariable[] = [];
  const s2sMeetingProvisioningBlockers: ZoomHostControlReadinessVariable[] = [];
  const hostAuthorizationBlockers: ZoomHostControlReadinessVariable[] = [];
  const canaryAuthorizationBlockers: ZoomRealControlCanaryAuthorizationVariable[] = [];

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
    sdkAppBlockers.push('ZOOM_MEETING_SDK_CLIENT_ID');
  }
  if (!config.zoomMeetingSdkCanonicalClientSecretConfigured) {
    sdkAppBlockers.push('ZOOM_MEETING_SDK_CLIENT_SECRET');
  }
  if (!hasExactSdkOriginBinding(config.publicBaseUrl, config.zoomMeetingSdkAllowedOrigin)) {
    sdkAppBlockers.push('ZOOM_MEETING_SDK_ALLOWED_ORIGIN');
  }
  if (!config.zoomMeetingSdkWebVersionConfigured) {
    sdkAppBlockers.push('ZOOM_MEETING_SDK_WEB_VERSION');
  }
  if (!config.zoomS2sAccountIdConfigured) {
    s2sMeetingProvisioningBlockers.push('ZOOM_S2S_ACCOUNT_ID');
  }
  if (!hasValue(config.zoomServerToServerClientId)) {
    s2sMeetingProvisioningBlockers.push('ZOOM_S2S_CLIENT_ID');
  }
  if (!hasValue(config.zoomServerToServerClientSecret)) {
    s2sMeetingProvisioningBlockers.push('ZOOM_S2S_CLIENT_SECRET');
  }
  if (!hasValue(config.zoomRealControlMeetingId)) {
    s2sMeetingProvisioningBlockers.push('ZOOM_REAL_CONTROL_MEETING_ID');
  }
  if (!hasValue(config.zoomRealControlMeetingPasscode)) {
    s2sMeetingProvisioningBlockers.push('ZOOM_REAL_CONTROL_MEETING_PASSCODE');
  }
  if (!hasValue(config.zoomHostUserId)) {
    hostAuthorizationBlockers.push('ZOOM_HOST_USER_ID');
  }
  if (!config.zoomClassroomCanaryEnabled) {
    canaryAuthorizationBlockers.push('ZOOM_CLASSROOM_CANARY_ENABLED');
  }
  if (!hasValue(config.zoomClassroomCanaryLearnerKey)) {
    canaryAuthorizationBlockers.push('ZOOM_CLASSROOM_CANARY_LEARNER_KEY');
  }

  const readinessBlockers = [
    ...sdkAppBlockers,
    ...s2sMeetingProvisioningBlockers,
    ...hostAuthorizationBlockers,
  ];

  return {
    ready:
      providerGateBlockers.length === 0 &&
      readinessBlockers.length === 0 &&
      canaryAuthorizationBlockers.length === 0,
    code:
      providerGateBlockers.length > 0
        ? 'PROVIDER_OFF'
        : readinessBlockers.length > 0
          ? 'PROVIDER_NOT_READY'
          : canaryAuthorizationBlockers.length > 0
            ? 'PROVIDER_OFF'
            : 'ZOOM_HOST_CONTROL_READY',
    provider_gate_blockers: providerGateBlockers,
    readiness_blockers: readinessBlockers,
    canary_authorization_blockers: canaryAuthorizationBlockers,
    phases: {
      sdk_app: phase(sdkAppBlockers),
      s2s_meeting_provisioning: phase(s2sMeetingProvisioningBlockers),
      host_authorization: phase(hostAuthorizationBlockers),
      real_control_canary_authorization: phase(canaryAuthorizationBlockers),
    },
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

function phase(blockerVariableNames: readonly string[]): ZoomHostControlReadinessPhase {
  return {
    ready: blockerVariableNames.length === 0,
    blocker_variable_names: [...blockerVariableNames],
  };
}

function hasExactSdkOriginBinding(publicBaseUrl: string, allowedOrigin: string | undefined) {
  if (!hasValue(allowedOrigin)) return false;
  try {
    const configured = new URL(allowedOrigin!);
    const runtime = new URL(publicBaseUrl);
    return (
      configured.protocol === 'https:' &&
      configured.username === '' &&
      configured.password === '' &&
      configured.pathname === '/' &&
      configured.search === '' &&
      configured.hash === '' &&
      configured.origin === runtime.origin
    );
  } catch {
    return false;
  }
}
