import { createHash, createHmac } from 'node:crypto';
import type { Request } from 'express';
import type {
  EmbeddedAttendanceSubject,
  EmbeddedJoinContextResolver,
  EmbeddedStudentActor,
  MeetingSdkBootstrapPort,
  VerifiedProviderAttendance,
} from '../../../../../../../packages/contracts/src/classroom/embedded/index.ts';
import type { JobScope } from '../../../../../../../packages/contracts/src/jobs/index.ts';
import type { PortalActorContext } from '../../../../../../../packages/contracts/src/portals/index.ts';
import { EmbeddedClassroomError } from '../../../../../../../packages/domain/src/classroom/embedded/index.ts';

export type EmbeddedStudentRequestIdentity = {
  scope: JobScope;
  actor: EmbeddedStudentActor;
};

export type EmbeddedAdminRequestIdentity = {
  scope: JobScope;
  admin_id: string;
};

export interface EmbeddedClassroomRequestIdentityResolver {
  resolveStudent(request: Request): Promise<EmbeddedStudentRequestIdentity | null>;
  resolveAdmin(request: Request): Promise<EmbeddedAdminRequestIdentity | null>;
}

export interface VerifiedProviderAttendanceResolver {
  verify(request: Request): Promise<VerifiedProviderAttendance | null>;
}

export interface AdminAttendanceSubjectResolver {
  resolve(input: {
    scope: JobScope;
    admin_id: string;
    occurrence_id: string;
    student_id: string;
  }): Promise<EmbeddedAttendanceSubject | null>;
}

export function createEmbeddedClassroomRequestIdentityResolver(input: {
  scope: JobScope;
  publicOrigin: string;
  lineageSecret: string;
  resolvePortalActor(request: Request): Promise<PortalActorContext | null>;
  verifyCsrf(request: Request, actor: PortalActorContext): Promise<boolean>;
}): EmbeddedClassroomRequestIdentityResolver {
  const expectedOrigin = new URL(input.publicOrigin).origin;
  return {
    async resolveStudent(request) {
      const actor = await input.resolvePortalActor(request);
      if (actor?.actor_role !== 'student' || actor.student_learner === null) return null;
      const csrfVerified =
        exactSameOrigin(request, expectedOrigin) && (await input.verifyCsrf(request, actor));
      return {
        scope: input.scope,
        actor: {
          role: 'student',
          student_id: actor.student_learner.learner_key,
          household_id: actor.student_learner.household_key,
          authenticated_session_id: actor.session_key,
          device_lineage_id: createHmac('sha256', input.lineageSecret)
            .update('p18-device-lineage-v1\0')
            .update(actor.session_key)
            .update('\0')
            .update(request.header('user-agent') ?? 'unknown-user-agent')
            .digest('hex'),
          csrf_verified: csrfVerified,
        },
      };
    },

    async resolveAdmin(request) {
      const actor = await input.resolvePortalActor(request);
      if (actor?.actor_role !== 'admin') return null;
      if (!exactSameOrigin(request, expectedOrigin) || !(await input.verifyCsrf(request, actor))) {
        return null;
      }
      return { scope: input.scope, admin_id: actor.actor_user_ref };
    },
  };
}

export function hashEmbeddedExchangeSecret(secret: string): string {
  return createHash('sha256').update('p18-bootstrap-exchange-v1\0').update(secret).digest('hex');
}

export function digestEmbeddedAttendanceEvidence(value: unknown): string {
  return createHash('sha256')
    .update('p18-attendance-source-v1\0')
    .update(stableJson(value))
    .digest('hex');
}

export function createUnavailableEmbeddedJoinContextResolver(): EmbeddedJoinContextResolver {
  const unavailable = async (): Promise<never> => {
    throw new EmbeddedClassroomError(
      'bootstrap_unavailable',
      'Candidate-bound classroom authorization is unavailable.',
    );
  };
  return {
    resolveForIssue: unavailable,
    resolve: unavailable,
    resolveLiveSession: unavailable,
  };
}

export function createUnavailableMeetingSdkBootstrapPort(): MeetingSdkBootstrapPort {
  return {
    async createEphemeralBootstrap() {
      throw new EmbeddedClassroomError(
        'bootstrap_unavailable',
        'Candidate-bound Meeting SDK signer is unavailable.',
      );
    },
  };
}

export function createUnavailableProviderAttendanceResolver(): VerifiedProviderAttendanceResolver {
  return { verify: async () => null };
}

export function createUnavailableAdminAttendanceSubjectResolver(): AdminAttendanceSubjectResolver {
  return { resolve: async () => null };
}

function exactSameOrigin(request: Request, expectedOrigin: string): boolean {
  const origin = request.header('origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === expectedOrigin;
  } catch {
    return false;
  }
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(',')}}`;
}
