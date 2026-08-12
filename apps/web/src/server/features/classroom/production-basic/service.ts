import { createHash } from 'node:crypto';
import {
  ZOOM_PRODUCTION_BASIC_BINDING_RECEIPT_MAX_AGE_MS,
  type AppConfig,
} from '../../../../../../../packages/config/src/index.ts';
import {
  createHostZoomSdkSignature,
  createLearnerZoomSdkSignature,
  createZoomRestClient,
} from '../../../../../../../packages/domain/src/providers/zoom-rest.ts';

/**
 * The production-basic path accepts only an already-authorized recurring meeting
 * plus a current digest-only verification receipt. Missing either keeps the
 * service unavailable by construction.
 */
export type ProductionBasicScope = {
  account_key: string;
  product_key: string;
};

export type ProductionBasicActor =
  | {
      kind: 'student';
      scope: ProductionBasicScope;
      learner_key: string;
      display_name: string;
      entitled: boolean;
    }
  | {
      kind: 'admin' | 'rabbi';
      scope: ProductionBasicScope;
      actor_user_ref: string;
      display_name: string;
      authorized_to_start: boolean;
    };

export type ProductionBasicLaunchArtifact = {
  mode: 'production_basic';
  role: 0 | 1;
  sdk_web_version: string;
  meeting_number: string;
  meeting_password: string;
  signature: string;
  user_name: string;
  leave_path: '/app/student' | '/app/live-console';
  issued_at: string;
  expires_at: string;
  /** Present only for a host Start; it is never persisted or put in a URL. */
  zak?: string;
  raw_join_url_present: false;
  video_start_model: 'PARTICIPANT_CONSENT';
};

export interface ProductionBasicMeetingBinding {
  ready(): Promise<boolean>;
  issue(input: {
    scope: ProductionBasicScope;
    actor: ProductionBasicActor;
    role: 0 | 1;
    now: Date;
  }): Promise<ProductionBasicLaunchArtifact | null>;
}

export type ProductionBasicLaunchResult =
  | { disposition: 'ready'; artifact: ProductionBasicLaunchArtifact }
  | { disposition: 'denied' | 'unavailable' };

export function createProductionBasicLaunchService(input: {
  binding: ProductionBasicMeetingBinding;
  clock?: () => Date;
}) {
  const clock = input.clock ?? (() => new Date());
  return {
    async ready(actor: ProductionBasicActor) {
      return actorMayLaunch(actor) && (await input.binding.ready());
    },
    async request(actor: ProductionBasicActor): Promise<ProductionBasicLaunchResult> {
      if (!actorMayLaunch(actor)) return { disposition: 'denied' };
      if (!(await input.binding.ready())) return { disposition: 'unavailable' };
      const role = actor.kind === 'student' ? (0 as const) : (1 as const);
      const artifact = await input.binding.issue({ scope: actor.scope, actor, role, now: clock() });
      if (!artifact || !validArtifact(artifact, role, clock()))
        return { disposition: 'unavailable' };
      return { disposition: 'ready', artifact };
    },
  };
}

export function createUnavailableProductionBasicMeetingBinding(): ProductionBasicMeetingBinding {
  return { ready: async () => false, issue: async () => null };
}

/**
 * This consumes only an already-authorized single recurring meeting reference.
 * It neither creates/adopts meetings nor considers canary flags. Missing any
 * canonical input leaves the production-basic surface unavailable.
 */
export function createCanonicalProductionBasicMeetingBinding(input: {
  config: AppConfig;
  verified_binding?: ProductionBasicVerifiedBindingReceipt | undefined;
  clock?: () => Date;
}): ProductionBasicMeetingBinding {
  const { config, verified_binding: verifiedBinding } = input;
  const clock = input.clock ?? (() => new Date());
  if (
    !config.zoomMeetingSdkCanonicalClientIdConfigured ||
    !config.zoomMeetingSdkCanonicalClientSecretConfigured ||
    !config.zoomMeetingSdkWebVersionConfigured ||
    !config.zoomAccountId ||
    !config.zoomServerToServerClientId ||
    !config.zoomServerToServerClientSecret ||
    !config.zoomHostUserId ||
    !config.zoomRealControlMeetingId ||
    !config.zoomRealControlMeetingPasscode ||
    !verifiedBindingMatches(config, verifiedBinding, clock()) ||
    !sameHttpsOrigin(config.publicBaseUrl, config.zoomMeetingSdkAllowedOrigin)
  ) {
    return createUnavailableProductionBasicMeetingBinding();
  }
  const rest = createZoomRestClient({
    credentials: {
      accountId: config.zoomAccountId,
      clientId: config.zoomServerToServerClientId,
      clientSecret: config.zoomServerToServerClientSecret,
    },
    environment: config.oneTimeRuntimeEnvironment === 'production' ? 'production' : 'staging',
    enabled: true,
  });
  return {
    ready: async () => verifiedBindingMatches(config, verifiedBinding, clock()),
    async issue({ actor, role, now }) {
      if (!verifiedBindingMatches(config, verifiedBinding, clock())) return null;
      const expiresAt = new Date(now.getTime() + 30 * 60_000);
      const shared = {
        mode: 'production_basic' as const,
        role,
        sdk_web_version: config.zoomMeetingSdkWebVersion!,
        meeting_number: config.zoomRealControlMeetingId!,
        meeting_password: config.zoomRealControlMeetingPasscode!,
        signature:
          role === 1
            ? createHostZoomSdkSignature({
                credentials: {
                  sdkKey: config.zoomMeetingSdkClientId!,
                  sdkSecret: config.zoomMeetingSdkClientSecret!,
                },
                meetingNumber: config.zoomRealControlMeetingId!,
                issuedAt: now,
                ttlSeconds: 30 * 60,
              })
            : createLearnerZoomSdkSignature({
                credentials: {
                  sdkKey: config.zoomMeetingSdkClientId!,
                  sdkSecret: config.zoomMeetingSdkClientSecret!,
                },
                meetingNumber: config.zoomRealControlMeetingId!,
                issuedAt: now,
                ttlSeconds: 30 * 60,
              }),
        user_name: actor.display_name,
        leave_path: role === 0 ? ('/app/student' as const) : ('/app/live-console' as const),
        issued_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        raw_join_url_present: false as const,
        video_start_model: 'PARTICIPANT_CONSENT' as const,
      };
      return role === 1
        ? { ...shared, zak: await rest.getHostZakToken(config.zoomHostUserId!) }
        : shared;
    },
  };
}

/** A provider owner issues this only after a bounded read-only verification. */
export type ProductionBasicVerifiedBindingReceipt = {
  account_matches: true;
  host_matches: true;
  registration_required: false;
  meeting_is_recurring: true;
  timezone: 'Asia/Jerusalem';
  weekly_days: readonly [1, 2, 3, 4, 5];
  first_occurrence_at: '2026-08-16T19:00:00+03:00';
  join_before_host: false;
  participant_video: false;
  auto_recording: 'none';
  meeting_ref_digest: string;
  checked_at: string;
  expires_at: string;
};

function sameHttpsOrigin(publicBaseUrl: string, allowedOrigin: string | undefined) {
  if (!allowedOrigin) return false;
  try {
    const publicOrigin = new URL(publicBaseUrl);
    const configured = new URL(allowedOrigin);
    return configured.protocol === 'https:' && configured.origin === publicOrigin.origin;
  } catch {
    return false;
  }
}

function actorMayLaunch(actor: ProductionBasicActor) {
  return actor.kind === 'student' ? actor.entitled : actor.authorized_to_start;
}

function verifiedBindingMatches(
  config: AppConfig,
  receipt: ProductionBasicVerifiedBindingReceipt | undefined,
  now: Date,
) {
  if (!receipt || receipt.account_matches !== true || receipt.host_matches !== true) return false;
  if (receipt.registration_required !== false || receipt.meeting_is_recurring !== true)
    return false;
  if (
    receipt.timezone !== 'Asia/Jerusalem' ||
    receipt.weekly_days.join(',') !== '1,2,3,4,5' ||
    receipt.first_occurrence_at !== '2026-08-16T19:00:00+03:00' ||
    receipt.join_before_host !== false ||
    receipt.participant_video !== false ||
    receipt.auto_recording !== 'none'
  ) {
    return false;
  }
  const checkedAt = Date.parse(receipt.checked_at);
  const expiresAt = Date.parse(receipt.expires_at);
  const freeAccessExpiresAt = config.oneTimeFreeAccessExpiresAt
    ? Date.parse(config.oneTimeFreeAccessExpiresAt)
    : null;
  if (
    !Number.isFinite(checkedAt) ||
    !Number.isFinite(expiresAt) ||
    checkedAt > now.getTime() ||
    checkedAt < now.getTime() - ZOOM_PRODUCTION_BASIC_BINDING_RECEIPT_MAX_AGE_MS ||
    expiresAt <= now.getTime() ||
    expiresAt - checkedAt > ZOOM_PRODUCTION_BASIC_BINDING_RECEIPT_MAX_AGE_MS ||
    (freeAccessExpiresAt !== null &&
      (!Number.isFinite(freeAccessExpiresAt) || expiresAt > freeAccessExpiresAt))
  ) {
    return false;
  }
  const meetingRefDigest = createHash('sha256')
    .update(`production-basic-meeting-v1\0${config.zoomRealControlMeetingId}`)
    .digest('hex');
  return receipt.meeting_ref_digest === meetingRefDigest;
}

function validArtifact(artifact: ProductionBasicLaunchArtifact, expectedRole: 0 | 1, now: Date) {
  return (
    artifact.mode === 'production_basic' &&
    artifact.role === expectedRole &&
    artifact.raw_join_url_present === false &&
    artifact.video_start_model === 'PARTICIPANT_CONSENT' &&
    artifact.meeting_number.trim().length > 0 &&
    artifact.meeting_password.trim().length > 0 &&
    artifact.signature.trim().length > 0 &&
    Date.parse(artifact.expires_at) > now.getTime() &&
    Date.parse(artifact.issued_at) <= now.getTime()
  );
}
