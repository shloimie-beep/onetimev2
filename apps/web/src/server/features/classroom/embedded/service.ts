import type {
  EmbeddedAdminActor,
  EmbeddedClassroomRepository,
  EmbeddedJoinContextResolver,
  EmbeddedStudentActor,
  MeetingSdkBootstrapPort,
  RedeemEmbeddedBootstrapInput,
  RedeemEmbeddedBootstrapResult,
} from '../../../../../../../packages/contracts/src/classroom/embedded/index.ts';
import {
  acquireLiveStudentSession,
  assertGrantAuthorizesContext,
  consumeLaunchGrant,
  decideEmbeddedJoin,
  EmbeddedClassroomError,
  heartbeatLiveStudentSession,
  revokeLiveStudentSession,
} from '../../../../../../../packages/domain/src/classroom/embedded/index.ts';
import type { JobScope } from '../../../../../../../packages/contracts/src/jobs/index.ts';

export interface EmbeddedClassroomService {
  redeem(input: RedeemEmbeddedBootstrapInput): Promise<RedeemEmbeddedBootstrapResult>;
  heartbeat(input: {
    scope: JobScope;
    actor: EmbeddedStudentActor;
    lease_generation: number;
    expected_version: number;
    now: Date;
  }): Promise<{ persisted: boolean; lease_expires_at: string; next_heartbeat_at: string }>;
  reset(input: {
    scope: JobScope;
    actor: EmbeddedAdminActor;
    student_id: string;
    now: Date;
  }): Promise<{ disposition: 'revoked' | 'not_active' }>;
}

export function createEmbeddedClassroomService(input: {
  repository: EmbeddedClassroomRepository;
  context_resolver: EmbeddedJoinContextResolver;
  sdk_bootstrap: MeetingSdkBootstrapPort;
}): EmbeddedClassroomService {
  return {
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
        lease_expires_at: next.lease_expires_at,
        next_heartbeat_at: new Date(command.now.getTime() + 30_000).toISOString(),
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
  };
}

function assertEphemeralBootstrap(
  bootstrap: Awaited<ReturnType<MeetingSdkBootstrapPort['createEphemeralBootstrap']>>,
  now: Date,
): void {
  const values = [
    bootstrap.sdk_session_ref,
    bootstrap.sdk_signature,
    bootstrap.participant_display_name,
  ];
  if (values.some((value) => value.trim() === '' || /https?:\/\//i.test(value))) {
    throw new EmbeddedClassroomError(
      'bootstrap_unavailable',
      'SDK bootstrap cannot contain an empty value or raw URL.',
    );
  }
  const issued = new Date(bootstrap.issued_at).getTime();
  const expires = new Date(bootstrap.expires_at).getTime();
  if (issued > now.getTime() || expires <= issued || expires - issued > 60_000) {
    throw new EmbeddedClassroomError('bootstrap_unavailable', 'SDK bootstrap lifetime is invalid.');
  }
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
