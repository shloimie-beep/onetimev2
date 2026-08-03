import type {
  AttendanceEvent,
  EmbeddedAdminActor,
  EmbeddedAttendanceSubject,
  EmbeddedClassroomRepository,
  EmbeddedJoinContextResolver,
  EmbeddedStudentActor,
  MeetingSdkBootstrapPort,
  RedeemEmbeddedBootstrapInput,
  RedeemEmbeddedBootstrapResult,
  VerifiedProviderAttendance,
} from '../../../../../../../packages/contracts/src/classroom/embedded/index.ts';
import { CLASSROOM_HEARTBEAT_INTERVAL_MS } from '../../../../../../../packages/contracts/src/classroom/embedded/index.ts';
import {
  acquireLiveStudentSession,
  assertGrantAuthorizesContext,
  consumeLaunchGrant,
  createLaunchGrant,
  decideEmbeddedJoin,
  EmbeddedClassroomError,
  heartbeatLiveStudentSession,
  reconcileAttendance,
  revokeLiveStudentSession,
} from '../../../../../../../packages/domain/src/classroom/embedded/index.ts';
import type { JobScope } from '../../../../../../../packages/contracts/src/jobs/index.ts';

export interface EmbeddedClassroomService {
  bootstrap(
    input: RedeemEmbeddedBootstrapInput & { grant_id: string },
  ): Promise<RedeemEmbeddedBootstrapResult>;
  redeem(input: RedeemEmbeddedBootstrapInput): Promise<RedeemEmbeddedBootstrapResult>;
  heartbeat(input: {
    scope: JobScope;
    actor: EmbeddedStudentActor;
    lease_generation: number;
    expected_version: number;
    now: Date;
  }): Promise<{
    persisted: boolean;
    lease_generation: number;
    version: number;
    lease_expires_at: string;
    next_heartbeat_at: string;
  }>;
  reset(input: {
    scope: JobScope;
    actor: EmbeddedAdminActor;
    student_id: string;
    now: Date;
  }): Promise<{ disposition: 'revoked' | 'not_active' }>;
  recordClientAttendance(input: {
    scope: JobScope;
    actor: EmbeddedStudentActor;
    event_kind: 'joined' | 'left';
    attendance_event_id: string;
    idempotency_key: string;
    source_event_ref_digest: string;
    now: Date;
  }): Promise<{ disposition: 'accepted' }>;
  recordVerifiedProviderAttendance(input: {
    verified: VerifiedProviderAttendance;
    now: Date;
  }): Promise<{ disposition: 'accepted' }>;
  recordAdminCorrection(input: {
    actor: EmbeddedAdminActor;
    subject: EmbeddedAttendanceSubject;
    event: AttendanceEvent;
    now: Date;
  }): Promise<{ disposition: 'accepted' }>;
}

export function createEmbeddedClassroomService(input: {
  repository: EmbeddedClassroomRepository;
  context_resolver: EmbeddedJoinContextResolver;
  sdk_bootstrap: MeetingSdkBootstrapPort;
}): EmbeddedClassroomService {
  return {
    async bootstrap(command) {
      if (!command.actor.csrf_verified) return denied('csrf_required');
      try {
        const context = await input.context_resolver.resolveForIssue({
          scope: command.scope,
          actor: command.actor,
        });
        const grant = createLaunchGrant({
          grant_id: command.grant_id,
          grant_key_digest: command.grant_key_digest,
          context,
          consent_version_digest: context.current_consent_version_digest,
          now: command.now,
        });
        await input.repository.insertLaunchGrant(grant);
        return await this.redeem(command);
      } catch (error) {
        if (error instanceof EmbeddedClassroomError && isSafeDenial(error.code)) {
          return denied(error.code);
        }
        throw error;
      }
    },

    async redeem(command) {
      if (!command.actor.csrf_verified) return denied('csrf_required');
      const grant = await input.repository.loadLaunchGrant({
        scope: command.scope,
        grant_key_digest: command.grant_key_digest,
      });
      if (grant === null) return denied('grant_invalid');
      try {
        const context = await input.context_resolver.resolve({
          scope: command.scope,
          actor: command.actor,
          grant,
        });
        assertGrantAuthorizesContext(grant, context, command.now);
        const eligibility = decideEmbeddedJoin(context, command.now);
        if (!eligibility.allowed) return denied(eligibility.safe_code);
        const current = await input.repository.loadLiveSession({
          scope: command.scope,
          student_id: command.actor.student_id,
        });
        const sessionDecision = acquireLiveStudentSession({
          current,
          context,
          live_session_id: command.live_session_id,
          now: command.now,
        });
        if (!sessionDecision.allowed) return denied(sessionDecision.safe_code);
        const consumed = consumeLaunchGrant(grant, command.now);
        const committed = await input.repository.commitBootstrap({
          prior_grant: grant,
          next_grant: consumed,
          prior_session: current,
          next_session: sessionDecision.session,
        });
        if (!committed) {
          throw new EmbeddedClassroomError(
            'authorization_changed',
            'Bootstrap authorization changed before commit.',
          );
        }
        try {
          const bootstrap = await input.sdk_bootstrap.createEphemeralBootstrap({
            context,
            grant: consumed,
            live_session: sessionDecision.session,
            now: command.now,
          });
          assertEphemeralBootstrap(bootstrap, command.now);
          return {
            disposition: 'ready',
            safe_code: 'join_allowed',
            session: sessionDecision.session,
            bootstrap,
            response_headers: {
              'cache-control': 'no-store',
              'referrer-policy': 'no-referrer',
            },
          };
        } catch {
          return denied('bootstrap_unavailable');
        }
      } catch (error) {
        if (error instanceof EmbeddedClassroomError && isSafeDenial(error.code)) {
          return denied(error.code);
        }
        throw error;
      }
    },

    async heartbeat(command) {
      if (!command.actor.csrf_verified) {
        throw new EmbeddedClassroomError('csrf_required', 'Current CSRF proof is required.');
      }
      const current = await input.repository.loadLiveSession({
        scope: command.scope,
        student_id: command.actor.student_id,
      });
      if (current === null) {
        throw new EmbeddedClassroomError(
          'authorization_changed',
          'No active live Student session exists.',
        );
      }
      const context = await input.context_resolver.resolveLiveSession({
        scope: command.scope,
        actor: command.actor,
        session: current,
      });
      assertLiveSessionAuthorization(current, context);
      const eligibility = decideEmbeddedJoin(context, command.now);
      if (!eligibility.allowed) {
        throw new EmbeddedClassroomError(
          eligibility.safe_code,
          'Live Student authorization is no longer current.',
        );
      }
      const next = heartbeatLiveStudentSession(current, {
        authenticated_session_id: command.actor.authenticated_session_id,
        device_lineage_id: command.actor.device_lineage_id,
        lease_generation: command.lease_generation,
        expected_version: command.expected_version,
        now: command.now,
      });
      const persisted = await input.repository.persistLiveSession({ prior: current, next });
      if (!persisted) {
        throw new EmbeddedClassroomError('stale_write', 'Live Student session changed.');
      }
      return {
        persisted: true,
        lease_generation: next.lease_generation,
        version: next.version,
        lease_expires_at: next.lease_expires_at,
        next_heartbeat_at: new Date(
          command.now.getTime() + CLASSROOM_HEARTBEAT_INTERVAL_MS,
        ).toISOString(),
      };
    },

    async reset(command) {
      const current = await input.repository.loadLiveSession({
        scope: command.scope,
        student_id: command.student_id,
      });
      if (current === null || current.state !== 'active') {
        return { disposition: 'not_active' };
      }
      const next = revokeLiveStudentSession(current, {
        admin_id: command.actor.admin_id,
        audit_ref: command.actor.audit_ref,
        now: command.now,
      });
      const persisted = await input.repository.resetStudentLaunch({
        prior_session: current,
        next_session: next,
        now: command.now,
      });
      if (!persisted) {
        throw new EmbeddedClassroomError('stale_write', 'Live Student session changed.');
      }
      return { disposition: 'revoked' };
    },

    async recordClientAttendance(command) {
      if (!command.actor.csrf_verified) {
        throw new EmbeddedClassroomError('csrf_required', 'Current CSRF proof is required.');
      }
      const current = await input.repository.loadLiveSession({
        scope: command.scope,
        student_id: command.actor.student_id,
      });
      if (current === null) {
        throw new EmbeddedClassroomError('authorization_changed', 'Live session is unavailable.');
      }
      assertActiveAttendanceSession(current, command.now);
      const context = await input.context_resolver.resolveLiveSession({
        scope: command.scope,
        actor: command.actor,
        session: current,
      });
      assertLiveSessionAuthorization(current, context);
      const eligibility = decideEmbeddedJoin(context, command.now);
      if (!eligibility.allowed) {
        throw new EmbeddedClassroomError(
          eligibility.safe_code,
          'Attendance authorization is no longer current.',
        );
      }
      const event: AttendanceEvent = {
        attendance_event_id: required(command.attendance_event_id),
        scope: command.scope,
        occurrence_id: current.occurrence_id,
        student_id: current.student_id,
        source: 'embedded_client',
        event_kind: command.event_kind,
        observed_at: command.now.toISOString(),
        connection_lineage_id: current.device_lineage_id,
        idempotency_key: required(command.idempotency_key),
        source_event_ref_digest: command.source_event_ref_digest,
        provider_verified: false,
        correction_intervals: [],
        correction_reason: null,
        correction_admin_id: null,
        audit_ref: null,
      };
      await persistReconciledAttendance(
        input.repository,
        subjectFromContext(context),
        event,
        command.now,
      );
      return { disposition: 'accepted' };
    },

    async recordVerifiedProviderAttendance(command) {
      const { event, subject } = command.verified;
      if (
        event.source !== 'zoom_provider' ||
        !event.provider_verified ||
        event.event_kind === 'manual_correction'
      ) {
        throw new EmbeddedClassroomError(
          'invalid_contract',
          'Provider attendance requires verified provider evidence.',
        );
      }
      assertAttendanceSubject(subject, event);
      await persistReconciledAttendance(input.repository, subject, event, command.now);
      return { disposition: 'accepted' };
    },

    async recordAdminCorrection(command) {
      const { event, subject } = command;
      if (
        event.source !== 'admin_correction' ||
        event.event_kind !== 'manual_correction' ||
        event.correction_admin_id !== command.actor.admin_id ||
        event.audit_ref !== command.actor.audit_ref
      ) {
        throw new EmbeddedClassroomError(
          'invalid_contract',
          'Attendance correction requires current audited Admin evidence.',
        );
      }
      assertAttendanceSubject(subject, event);
      await persistReconciledAttendance(input.repository, subject, event, command.now);
      return { disposition: 'accepted' };
    },
  };
}

async function persistReconciledAttendance(
  repository: EmbeddedClassroomRepository,
  subject: EmbeddedAttendanceSubject,
  event: AttendanceEvent,
  now: Date,
): Promise<void> {
  assertAttendanceSubject(subject, event);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const evidence = await repository.loadAttendanceEvidence({
      scope: subject.scope,
      occurrence_id: subject.occurrence_id,
      student_id: subject.student_id,
    });
    const events = [...evidence.events, event];
    const next = reconcileAttendance({
      events,
      scheduled_start_at: subject.scheduled_start_at,
      scheduled_end_at: subject.scheduled_end_at,
      prior_projection: evidence.projection,
      now,
    });
    if (
      await repository.appendAttendance({
        events: [event],
        prior_projection: evidence.projection,
        next_projection: next,
      })
    ) {
      return;
    }
  }
  throw new EmbeddedClassroomError('stale_write', 'Attendance evidence changed.');
}

function subjectFromContext(context: Awaited<ReturnType<EmbeddedJoinContextResolver['resolve']>>) {
  return {
    scope: context.scope,
    occurrence_id: context.occurrence.id,
    student_id: context.actor.student_id,
    registrant_id: context.registrant_id,
    scheduled_start_at: context.occurrence.startsAt,
    scheduled_end_at: context.occurrence.scheduledEndsAt,
  } satisfies EmbeddedAttendanceSubject;
}

function assertLiveSessionAuthorization(
  session: Parameters<EmbeddedJoinContextResolver['resolveLiveSession']>[0]['session'],
  context: Awaited<ReturnType<EmbeddedJoinContextResolver['resolveLiveSession']>>,
): void {
  if (
    session.scope.product !== context.scope.product ||
    session.scope.runtime_tier !== context.scope.runtime_tier ||
    session.scope.verification_environment_id !== context.scope.verification_environment_id ||
    session.student_id !== context.actor.student_id ||
    session.household_id !== context.actor.household_id ||
    session.authenticated_session_id !== context.actor.authenticated_session_id ||
    session.device_lineage_id !== context.actor.device_lineage_id ||
    session.occurrence_id !== context.occurrence.id
  ) {
    throw new EmbeddedClassroomError(
      'authorization_changed',
      'Live Student authorization changed.',
    );
  }
}

function assertAttendanceSubject(subject: EmbeddedAttendanceSubject, event: AttendanceEvent): void {
  if (
    subject.scope.product !== event.scope.product ||
    subject.scope.runtime_tier !== event.scope.runtime_tier ||
    subject.scope.verification_environment_id !== event.scope.verification_environment_id ||
    subject.occurrence_id !== event.occurrence_id ||
    subject.student_id !== event.student_id ||
    subject.registrant_id.trim() === ''
  ) {
    throw new EmbeddedClassroomError('invalid_contract', 'Attendance subject does not correlate.');
  }
}

function assertActiveAttendanceSession(
  session: Parameters<EmbeddedJoinContextResolver['resolveLiveSession']>[0]['session'],
  now: Date,
): void {
  const nowMs = now.getTime();
  const leaseExpiresAt = new Date(session.lease_expires_at).getTime();
  if (
    session.state !== 'active' ||
    !Number.isFinite(nowMs) ||
    !Number.isFinite(leaseExpiresAt) ||
    leaseExpiresAt <= nowMs
  ) {
    throw new EmbeddedClassroomError(
      'authorization_changed',
      'An active unexpired live Student session is required.',
    );
  }
}

function assertEphemeralBootstrap(
  bootstrap: Awaited<ReturnType<MeetingSdkBootstrapPort['createEphemeralBootstrap']>>,
  now: Date,
): void {
  const requiredStrings = [
    bootstrap.sdk_session_ref,
    bootstrap.sdk_web_version,
    bootstrap.sdk_signature,
    bootstrap.meeting_number,
    bootstrap.meeting_password,
    bootstrap.registrant_token,
    bootstrap.participant_email,
    bootstrap.customer_key,
    bootstrap.participant_display_name,
  ];
  if (
    requiredStrings.some(
      (value) => typeof value !== 'string' || value.trim() === '' || isUrlLike(value),
    )
  ) {
    throw new EmbeddedClassroomError(
      'bootstrap_unavailable',
      'SDK bootstrap cannot contain an empty value or raw URL.',
    );
  }
  if (!/^\d+\.\d+\.\d+$/u.test(bootstrap.sdk_web_version)) {
    throw new EmbeddedClassroomError('bootstrap_unavailable', 'SDK bootstrap version is invalid.');
  }
  if (!/^\d{9,32}$/u.test(bootstrap.meeting_number)) {
    throw new EmbeddedClassroomError(
      'bootstrap_unavailable',
      'SDK bootstrap meeting number is invalid.',
    );
  }
  const issued = new Date(bootstrap.issued_at).getTime();
  const expires = new Date(bootstrap.expires_at).getTime();
  const current = now.getTime();
  if (
    !Number.isFinite(issued) ||
    !Number.isFinite(expires) ||
    !Number.isFinite(current) ||
    issued > current ||
    current >= expires ||
    expires <= issued ||
    expires - issued > 60_000
  ) {
    throw new EmbeddedClassroomError('bootstrap_unavailable', 'SDK bootstrap lifetime is invalid.');
  }
  if (bootstrap.role !== 0 || bootstrap.leave_path !== '/app/classroom') {
    throw new EmbeddedClassroomError('bootstrap_unavailable', 'SDK bootstrap scope is invalid.');
  }
  if (typeof bootstrap.recording_capture_active !== 'boolean') {
    throw new EmbeddedClassroomError(
      'bootstrap_unavailable',
      'SDK recording indicator state is invalid.',
    );
  }
}

function isUrlLike(value: string): boolean {
  const candidate = value.trim();
  if (candidate.startsWith('//')) return true;
  try {
    new URL(candidate);
    return true;
  } catch {
    return false;
  }
}

function required(value: string): string {
  if (value.trim() === '') {
    throw new EmbeddedClassroomError('invalid_contract', 'Opaque evidence is required.');
  }
  return value;
}

function denied(
  safe_code: Exclude<RedeemEmbeddedBootstrapResult, { disposition: 'ready' }>['safe_code'],
): RedeemEmbeddedBootstrapResult {
  return { disposition: 'denied', safe_code };
}

function isSafeDenial(
  code: EmbeddedClassroomError['code'],
): code is Exclude<RedeemEmbeddedBootstrapResult, { disposition: 'ready' }>['safe_code'] {
  return !['invalid_contract', 'stale_write'].includes(code);
}
