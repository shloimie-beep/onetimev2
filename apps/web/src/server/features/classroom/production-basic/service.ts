import { createHash } from 'node:crypto';
import {
  ZOOM_PRODUCTION_BASIC_BINDING_RECEIPT_MAX_AGE_MS,
  type AppConfig,
} from '../../../../../../../packages/config/src/index.ts';
import {
  createHostZoomSdkSignature,
  createLearnerZoomSdkSignature,
  createZoomHostZakClient,
} from '../../../../../../../packages/domain/src/providers/zoom-rest.ts';
import type {
  ProductionBasicHostLifecycleState,
  ProductionBasicHostLifecycleStore,
} from './host-lifecycle-repository.ts';

export const PRODUCTION_BASIC_LIVE_MARKER_TTL_MS = 2 * 60 * 60_000;

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
      kind: 'parent';
      scope: ProductionBasicScope;
      participant_id: string;
      household_id: string;
      display_name: string;
      entitled: boolean;
    }
  | {
      kind: 'admin' | 'rabbi';
      scope: ProductionBasicScope;
      actor_user_ref: string;
      /** Server-only exact authenticated session reference; never serialized or logged. */
      session_ref: string;
      display_name: string;
      authorized_to_start: boolean;
    };

type ProductionBasicLaunchArtifactBase = {
  mode: 'production_basic';
  sdk_web_version: string;
  meeting_number: string;
  meeting_password: string;
  signature: string;
  user_name: string;
  issued_at: string;
  expires_at: string;
  raw_join_url_present: false;
  video_start_model: 'PARTICIPANT_CONSENT';
};

export type StudentProductionBasicLaunchArtifact = ProductionBasicLaunchArtifactBase & {
  role: 0;
  leave_path: '/app/student';
  zak?: never;
};

export type ParentProductionBasicLaunchArtifact = ProductionBasicLaunchArtifactBase & {
  role: 0;
  leave_path: '/app/parent';
  zak?: never;
};

export type HostProductionBasicLaunchArtifact = ProductionBasicLaunchArtifactBase & {
  role: 1;
  leave_path: '/app/live-console';
  /** Host-only and ephemeral; it is never persisted or put in a URL. */
  zak: string;
};

export type ProductionBasicLaunchArtifact =
  | StudentProductionBasicLaunchArtifact
  | ParentProductionBasicLaunchArtifact
  | HostProductionBasicLaunchArtifact;

export interface ProductionBasicMeetingBinding {
  ready(): Promise<boolean>;
  referenceDigest(): string | null;
  issue(input: {
    scope: ProductionBasicScope;
    actor: ProductionBasicActor;
    role: 0 | 1;
    now: Date;
  }): Promise<ProductionBasicLaunchArtifact | null>;
}

export interface ProductionBasicHostLiveMarker {
  confirm(input: {
    scope: ProductionBasicScope;
    meeting_ref_digest: string;
    confirmed_at: Date;
  }): Promise<boolean>;
  currentForStudent(input: {
    scope: ProductionBasicScope;
    learner_key: string;
    meeting_ref_digest: string;
    observed_at: Date;
  }): Promise<boolean>;
  currentForParent(input: {
    scope: ProductionBasicScope;
    participant_id: string;
    household_id: string;
    meeting_ref_digest: string;
    observed_at: Date;
  }): Promise<boolean>;
  clear(input: {
    scope: ProductionBasicScope;
    meeting_ref_digest: string;
    occurrence_key?: string | undefined;
    cleared_at: Date;
  }): Promise<void>;
}

export type ProductionBasicLaunchResult =
  | { disposition: 'ready'; artifact: ProductionBasicLaunchArtifact }
  | { disposition: 'denied' | 'unavailable' };

export type ProductionBasicHostLiveResult = {
  disposition: 'ready' | 'denied' | 'unavailable';
  lifecycle_context?: string | undefined;
  state?: ProductionBasicHostLifecycleState | undefined;
};

export function createProductionBasicLaunchService(input: {
  binding: ProductionBasicMeetingBinding;
  hostLiveMarker?: ProductionBasicHostLiveMarker | undefined;
  hostLifecycle?: ProductionBasicHostLifecycleStore | undefined;
  clock?: () => Date;
}) {
  const clock = input.clock ?? (() => new Date());
  return {
    async ready(actor: ProductionBasicActor) {
      if (!actorMayLaunch(actor) || !(await input.binding.ready())) return false;
      if (actor.kind === 'student') return studentLiveMarkerCurrent(input, actor, clock());
      if (actor.kind === 'parent') return parentLiveMarkerCurrent(input, actor, clock());
      return true;
    },
    async request(actor: ProductionBasicActor): Promise<ProductionBasicLaunchResult> {
      if (!actorMayLaunch(actor)) return { disposition: 'denied' };
      if (!(await input.binding.ready())) return { disposition: 'unavailable' };
      if (actor.kind === 'student' && !(await studentLiveMarkerCurrent(input, actor, clock()))) {
        return { disposition: 'unavailable' };
      }
      if (actor.kind === 'parent' && !(await parentLiveMarkerCurrent(input, actor, clock()))) {
        return { disposition: 'unavailable' };
      }
      const role =
        actor.kind === 'student' || actor.kind === 'parent' ? (0 as const) : (1 as const);
      const artifact = await input.binding.issue({ scope: actor.scope, actor, role, now: clock() });
      if (!artifact || !validArtifactForActor(artifact, actor, clock()))
        return { disposition: 'unavailable' };
      return { disposition: 'ready', artifact };
    },
    async confirmHostLive(actor: ProductionBasicActor): Promise<ProductionBasicHostLiveResult> {
      if ((actor.kind !== 'admin' && actor.kind !== 'rabbi') || !actor.authorized_to_start) {
        return { disposition: 'denied' };
      }
      if (!(await input.binding.ready())) return { disposition: 'unavailable' };
      const meetingRefDigest = input.binding.referenceDigest();
      if (!meetingRefDigest || !input.hostLiveMarker || !input.hostLifecycle) {
        return { disposition: 'unavailable' };
      }
      const lifecycle = await input.hostLifecycle.createLive({
        scope: actor.scope,
        meetingRefDigest,
        actorUserRef: actor.actor_user_ref,
        sessionRef: actor.session_ref,
        now: clock(),
      });
      if (
        !lifecycle?.context ||
        !['live', 'end_requested', 'unknown_effect'].includes(lifecycle.state)
      ) {
        return { disposition: 'unavailable' };
      }
      const confirmed = await input.hostLiveMarker.confirm({
        scope: actor.scope,
        meeting_ref_digest: meetingRefDigest,
        confirmed_at: clock(),
      });
      return confirmed
        ? { disposition: 'ready', lifecycle_context: lifecycle.context, state: lifecycle.state }
        : { disposition: 'unavailable' };
    },
    async beginHostEnd(actor: ProductionBasicActor, lifecycleContext: string) {
      const lifecycle = await authorizeLifecycle(input, actor, lifecycleContext, clock());
      if (!lifecycle) return { disposition: 'denied' as const };
      const state = await input.hostLifecycle!.beginEnd(lifecycle);
      return state ? { disposition: 'ready' as const, state } : { disposition: 'denied' as const };
    },
    async markHostEndUnknown(actor: ProductionBasicActor, lifecycleContext: string) {
      const lifecycle = await authorizeLifecycle(input, actor, lifecycleContext, clock());
      if (!lifecycle) return { disposition: 'denied' as const };
      const state = await input.hostLifecycle!.markUnknown(lifecycle);
      return state ? { disposition: 'ready' as const, state } : { disposition: 'denied' as const };
    },
    async reconcileHostEnd(actor: ProductionBasicActor, lifecycleContext: string) {
      const lifecycle = await authorizeLifecycle(input, actor, lifecycleContext, clock());
      if (!lifecycle) return { disposition: 'denied' as const };
      const state = await input.hostLifecycle!.reconcile(lifecycle);
      if (!state) return { disposition: 'denied' as const };
      if (state !== 'provider_ended' && state !== 'cleanup_pending') {
        return { disposition: 'ready' as const, state };
      }
      return cleanupAuthorizedLifecycle(input, lifecycle);
    },
    async hostEndStatus(actor: ProductionBasicActor, lifecycleContext: string) {
      if ((actor.kind !== 'admin' && actor.kind !== 'rabbi') || !actor.authorized_to_start) {
        return { disposition: 'denied' as const };
      }
      const meetingRefDigest = input.binding.referenceDigest();
      if (!meetingRefDigest || !input.hostLifecycle || !lifecycleContext) {
        return { disposition: 'unavailable' as const };
      }
      const lifecycle = await input.hostLifecycle.read({
        scope: actor.scope,
        meetingRefDigest,
        actorUserRef: actor.actor_user_ref,
        sessionRef: actor.session_ref,
        context: lifecycleContext,
        now: clock(),
      });
      return lifecycle
        ? {
            disposition: 'ready' as const,
            state: lifecycle.state,
            lifecycle_context: lifecycle.context ?? undefined,
          }
        : { disposition: 'unavailable' as const };
    },
    async cleanupHostEnd(actor: ProductionBasicActor, lifecycleContext: string) {
      const lifecycle = await authorizeLifecycle(input, actor, lifecycleContext, clock());
      if (!lifecycle) return { disposition: 'denied' as const };
      return cleanupAuthorizedLifecycle(input, lifecycle);
    },
  };
}

async function authorizeLifecycle(
  input: {
    binding: ProductionBasicMeetingBinding;
    hostLifecycle?: ProductionBasicHostLifecycleStore | undefined;
  },
  actor: ProductionBasicActor,
  lifecycleContext: string,
  now: Date,
) {
  if (
    (actor.kind !== 'admin' && actor.kind !== 'rabbi') ||
    !actor.authorized_to_start ||
    !input.hostLifecycle ||
    !lifecycleContext ||
    lifecycleContext.length > 200
  ) {
    return null;
  }
  const meetingRefDigest = input.binding.referenceDigest();
  if (!meetingRefDigest) return null;
  return {
    scope: actor.scope,
    meetingRefDigest,
    actorUserRef: actor.actor_user_ref,
    sessionRef: actor.session_ref,
    context: lifecycleContext,
    now,
  };
}

async function cleanupAuthorizedLifecycle(
  input: {
    hostLiveMarker?: ProductionBasicHostLiveMarker | undefined;
    hostLifecycle?: ProductionBasicHostLifecycleStore | undefined;
  },
  lifecycle: {
    scope: ProductionBasicScope;
    meetingRefDigest: string;
    actorUserRef: string;
    sessionRef: string;
    context: string;
    now: Date;
  },
) {
  if (!input.hostLiveMarker || !input.hostLifecycle) {
    return { disposition: 'unavailable' as const };
  }
  const target = await input.hostLifecycle.beginCleanup(lifecycle);
  if (!target) return { disposition: 'denied' as const };
  try {
    await input.hostLiveMarker.clear({
      scope: target.scope,
      meeting_ref_digest: target.meetingRefDigest,
      occurrence_key: target.occurrenceKey,
      cleared_at: target.clearedAt,
    });
    const ended = await input.hostLifecycle.finishCleanup(lifecycle);
    return ended
      ? { disposition: 'ready' as const, state: ended }
      : { disposition: 'unavailable' as const };
  } catch {
    await input.hostLifecycle.markCleanupPending(lifecycle);
    return { disposition: 'ready' as const, state: 'cleanup_pending' as const };
  }
}

async function studentLiveMarkerCurrent(
  input: {
    binding: ProductionBasicMeetingBinding;
    hostLiveMarker?: ProductionBasicHostLiveMarker | undefined;
  },
  actor: Extract<ProductionBasicActor, { kind: 'student' }>,
  observedAt: Date,
) {
  const meetingRefDigest = input.binding.referenceDigest();
  if (!meetingRefDigest || !input.hostLiveMarker) return false;
  return input.hostLiveMarker.currentForStudent({
    scope: actor.scope,
    learner_key: actor.learner_key,
    meeting_ref_digest: meetingRefDigest,
    observed_at: observedAt,
  });
}

async function parentLiveMarkerCurrent(
  input: {
    binding: ProductionBasicMeetingBinding;
    hostLiveMarker?: ProductionBasicHostLiveMarker | undefined;
  },
  actor: Extract<ProductionBasicActor, { kind: 'parent' }>,
  observedAt: Date,
) {
  const meetingRefDigest = input.binding.referenceDigest();
  if (!meetingRefDigest || !input.hostLiveMarker) return false;
  return input.hostLiveMarker.currentForParent({
    scope: actor.scope,
    participant_id: actor.participant_id,
    household_id: actor.household_id,
    meeting_ref_digest: meetingRefDigest,
    observed_at: observedAt,
  });
}

export function createUnavailableProductionBasicMeetingBinding(): ProductionBasicMeetingBinding {
  return { ready: async () => false, referenceDigest: () => null, issue: async () => null };
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
    !sameHttpsOrigin(config.applicationBaseUrl, config.zoomMeetingSdkAllowedOrigin)
  ) {
    return createUnavailableProductionBasicMeetingBinding();
  }
  const hostZak = createZoomHostZakClient({
    credentials: {
      accountId: config.zoomAccountId,
      clientId: config.zoomServerToServerClientId,
      clientSecret: config.zoomServerToServerClientSecret,
    },
    hostUserId: config.zoomHostUserId,
    environment: config.oneTimeRuntimeEnvironment === 'production' ? 'production' : 'staging',
    enabled: true,
  });
  return {
    ready: async () => verifiedBindingMatches(config, verifiedBinding, clock()),
    referenceDigest: () => productionBasicMeetingRefDigest(config.zoomRealControlMeetingId!),
    async issue({ actor, role, now }) {
      if (!verifiedBindingMatches(config, verifiedBinding, clock())) return null;
      const expiresAt = new Date(now.getTime() + 30 * 60_000);
      const shared = {
        mode: 'production_basic' as const,
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
        issued_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        raw_join_url_present: false as const,
        video_start_model: 'PARTICIPANT_CONSENT' as const,
      };
      if (role === 1) {
        return {
          ...shared,
          role: 1,
          leave_path: '/app/live-console',
          zak: await hostZak.getHostZakToken(),
        };
      }
      return actor.kind === 'parent'
        ? { ...shared, role: 0, leave_path: '/app/parent' }
        : { ...shared, role: 0, leave_path: '/app/student' };
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

function sameHttpsOrigin(applicationBaseUrl: string, allowedOrigin: string | undefined) {
  if (!allowedOrigin) return false;
  try {
    const applicationOrigin = new URL(applicationBaseUrl);
    const configured = new URL(allowedOrigin);
    return (
      configured.protocol === 'https:' &&
      configured.username === '' &&
      configured.password === '' &&
      configured.pathname === '/' &&
      configured.search === '' &&
      configured.hash === '' &&
      configured.origin === applicationOrigin.origin
    );
  } catch {
    return false;
  }
}

function actorMayLaunch(actor: ProductionBasicActor) {
  return actor.kind === 'student' || actor.kind === 'parent'
    ? actor.entitled
    : actor.authorized_to_start;
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
  const meetingRefDigest = productionBasicMeetingRefDigest(config.zoomRealControlMeetingId!);
  return receipt.meeting_ref_digest === meetingRefDigest;
}

export function productionBasicMeetingRefDigest(meetingId: string) {
  return createHash('sha256').update(`production-basic-meeting-v1\0${meetingId}`).digest('hex');
}

export function isStudentProductionBasicLaunchArtifact(
  artifact: ProductionBasicLaunchArtifact,
  now: Date,
): artifact is StudentProductionBasicLaunchArtifact {
  return (
    validArtifactBase(artifact, now) &&
    artifact.role === 0 &&
    artifact.leave_path === '/app/student' &&
    !('zak' in artifact)
  );
}

export function isParentProductionBasicLaunchArtifact(
  artifact: ProductionBasicLaunchArtifact,
  now: Date,
): artifact is ParentProductionBasicLaunchArtifact {
  return (
    validArtifactBase(artifact, now) &&
    artifact.role === 0 &&
    artifact.leave_path === '/app/parent' &&
    !('zak' in artifact)
  );
}

export function isHostProductionBasicLaunchArtifact(
  artifact: ProductionBasicLaunchArtifact,
  now: Date,
): artifact is HostProductionBasicLaunchArtifact {
  return (
    validArtifactBase(artifact, now) &&
    artifact.role === 1 &&
    artifact.leave_path === '/app/live-console' &&
    typeof artifact.zak === 'string' &&
    artifact.zak.trim().length > 0
  );
}

function validArtifactForActor(
  artifact: ProductionBasicLaunchArtifact,
  actor: ProductionBasicActor,
  now: Date,
) {
  if (actor.kind === 'student') return isStudentProductionBasicLaunchArtifact(artifact, now);
  if (actor.kind === 'parent') return isParentProductionBasicLaunchArtifact(artifact, now);
  return isHostProductionBasicLaunchArtifact(artifact, now);
}

function validArtifactBase(artifact: ProductionBasicLaunchArtifact, now: Date) {
  return (
    artifact.mode === 'production_basic' &&
    artifact.raw_join_url_present === false &&
    artifact.video_start_model === 'PARTICIPANT_CONSENT' &&
    artifact.user_name.trim().length > 0 &&
    artifact.meeting_number.trim().length > 0 &&
    artifact.meeting_password.trim().length > 0 &&
    artifact.signature.trim().length > 0 &&
    Date.parse(artifact.expires_at) > now.getTime() &&
    Date.parse(artifact.issued_at) <= now.getTime()
  );
}
