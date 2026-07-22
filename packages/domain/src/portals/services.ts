import { createHash, randomUUID } from 'node:crypto';
import type {
  AdministrativeUpdate,
  BillingSummary,
  ClassLeaderboardSummary,
  HelperAnswer,
  CreateLearnerPayload,
  HelperAvailability,
  HelperQueryPayload,
  HouseholdOverview,
  LearnerProfile,
  LibraryItem,
  ParentPortalDashboard,
  PortalActorContext,
  PortalCapability,
  PortalErrorCode,
  ProgressSummary,
  ProtectedActionDescriptor,
  RewardBalance,
  RewardEvent,
  StudentAccessOperationPayload,
  StudentAccessOperationType,
  StudentAccessState,
  StudentQuestion,
  StudentQuestionPayload,
  StudentPortalDashboard,
  SupportPreview,
  SupportRequestPayload,
  UpdateLearnerPayload,
  UpcomingClassSummary,
} from '../../../contracts/src/portals/index.ts';
import type { GamificationSummary } from '../../../contracts/src/gamification/index.ts';
import {
  hasPortalCapability,
  normalizeStudentUsername,
} from '../../../contracts/src/portals/index.ts';

export type { StudentAccessOperationType } from '../../../contracts/src/portals/index.ts';

export class PortalServiceError extends Error {
  readonly code: PortalErrorCode;
  readonly currentVersion?: number;

  constructor(code: PortalErrorCode, message: string, currentVersion?: number) {
    super(message);
    this.code = code;
    if (currentVersion !== undefined) {
      this.currentVersion = currentVersion;
    }
  }
}

export type PortalAuditRecord = {
  action_type: string;
  actor: PortalActorContext;
  household_key?: string;
  learner_key?: string;
  metadata?: Record<string, unknown>;
};

export type CredentialLifecycleResult = {
  operation_ref: string;
  status: StudentAccessState['status'];
  expires_at: string | null;
  delivery_hint: string | null;
  student_user_ref?: string | null;
  username_display?: string | null;
  credential_status?: StudentAccessState['credential_status'];
  password_hash_ref?: string | null;
  password_version?: number;
  security_version?: number;
  last_reset_at?: string | null;
  last_session_revoked_at?: string | null;
};

export type RewardWriteInput = {
  learner_key: string;
  points_delta: number;
  reason_code: string;
  reason_label: string;
  idempotency_key: string;
  correction_of_event_key?: string | null;
};

export type PortalRepository = {
  getHousehold(args: {
    actor: PortalActorContext;
    household_key: string;
  }): Promise<HouseholdOverview | null>;
  listLearners(args: {
    actor: PortalActorContext;
    household_key: string;
    include_archived?: boolean;
  }): Promise<LearnerProfile[]>;
  getLearner(args: {
    actor: PortalActorContext;
    household_key: string;
    learner_key: string;
  }): Promise<LearnerProfile | null>;
  createLearner(args: {
    actor: PortalActorContext;
    household_key: string;
    payload: CreateLearnerPayload;
    request_fingerprint: string;
  }): Promise<LearnerProfile>;
  updateLearner(args: {
    actor: PortalActorContext;
    household_key: string;
    learner_key: string;
    payload: UpdateLearnerPayload;
    request_fingerprint: string;
  }): Promise<LearnerProfile>;
  setLearnerStatus(args: {
    actor: PortalActorContext;
    household_key: string;
    learner_key: string;
    status: 'active' | 'archived' | 'suspended';
    version: number;
    idempotency_key: string;
    request_fingerprint: string;
  }): Promise<LearnerProfile>;
  getStudentAccessState(args: {
    actor: PortalActorContext;
    learner_key: string;
  }): Promise<StudentAccessState>;
  recordStudentAccessOperation(args: {
    actor: PortalActorContext;
    learner_key: string;
    operation_type: StudentAccessOperationType;
    idempotency_key: string;
    request_fingerprint: string;
    adapter_result: CredentialLifecycleResult;
  }): Promise<StudentAccessState>;
  listUpdates(args: {
    actor: PortalActorContext;
    learner_key: string;
    audience: 'parent' | 'student';
  }): Promise<AdministrativeUpdate[]>;
  getRewardBalance(args: {
    actor: PortalActorContext;
    learner_key: string;
  }): Promise<RewardBalance>;
  listRewardEvents(args: {
    actor: PortalActorContext;
    learner_key: string;
    limit?: number;
  }): Promise<RewardEvent[]>;
  listStudentQuestions(args: {
    actor: PortalActorContext;
    learner_key: string;
    limit?: number;
  }): Promise<StudentQuestion[]>;
  submitStudentQuestion(args: {
    actor: PortalActorContext;
    learner_key: string;
    payload: StudentQuestionPayload;
    request_fingerprint: string;
  }): Promise<StudentQuestion>;
  addRewardEvent(args: {
    actor: PortalActorContext;
    input: RewardWriteInput;
    source_type: 'admin' | 'parent_capability' | 'system';
    request_fingerprint: string;
  }): Promise<RewardEvent>;
  recordAudit(record: PortalAuditRecord): Promise<void>;
};

export type LearnerClassAccessAdapter = {
  upcomingForLearner(args: {
    actor: PortalActorContext;
    learner: LearnerProfile;
  }): Promise<UpcomingClassSummary[]>;
  protectedLaunch(args: {
    actor: PortalActorContext;
    learner: LearnerProfile;
    class_key: string;
    idempotency_key?: string | undefined;
  }): Promise<ProtectedActionDescriptor>;
};

export type LearnerContentAccessAdapter = {
  publishedLibraryForLearner(args: {
    actor: PortalActorContext;
    learner: LearnerProfile;
  }): Promise<LibraryItem[]>;
  reviewSheetsForLearner(args: {
    actor: PortalActorContext;
    learner: LearnerProfile;
  }): Promise<LibraryItem[]>;
};

export type LearnerProgressAdapter = {
  progressForLearner(args: {
    actor: PortalActorContext;
    learner: LearnerProfile;
  }): Promise<ProgressSummary>;
};

export type PortalUpdatesAdapter = {
  externalUpdatesForLearner?(args: {
    actor: PortalActorContext;
    learner: LearnerProfile;
    audience: 'parent' | 'student';
  }): Promise<AdministrativeUpdate[]>;
};

export type StudentCredentialLifecycleAdapter = {
  requestSetup(args: {
    actor: PortalActorContext;
    learner: LearnerProfile;
    payload: StudentAccessOperationPayload;
  }): Promise<CredentialLifecycleResult>;
  requestReset(args: {
    actor: PortalActorContext;
    learner: LearnerProfile;
    payload: StudentAccessOperationPayload;
  }): Promise<CredentialLifecycleResult>;
  requestSuspend(args: {
    actor: PortalActorContext;
    learner: LearnerProfile;
    payload: StudentAccessOperationPayload;
  }): Promise<CredentialLifecycleResult>;
  requestRestore(args: {
    actor: PortalActorContext;
    learner: LearnerProfile;
    payload: StudentAccessOperationPayload;
  }): Promise<CredentialLifecycleResult>;
  requestRevokeSessions(args: {
    actor: PortalActorContext;
    learner: LearnerProfile;
    payload: StudentAccessOperationPayload;
  }): Promise<CredentialLifecycleResult>;
};

export type ScopedPortalHelperAdapter = {
  availability(args: {
    actor: PortalActorContext;
    learner?: LearnerProfile;
    household?: HouseholdOverview;
  }): Promise<HelperAvailability>;
  query?(args: {
    actor: PortalActorContext;
    learner?: LearnerProfile;
    household?: HouseholdOverview;
    payload: HelperQueryPayload;
  }): Promise<HelperAnswer>;
};

export type SupportRequestAdapter = {
  preview(args: {
    actor: PortalActorContext;
    learner?: LearnerProfile;
    household?: HouseholdOverview;
    payload: SupportRequestPayload;
  }): Promise<SupportPreview>;
  confirm?(args: { actor: PortalActorContext; preview_key: string }): Promise<SupportPreview>;
};

export type BillingSummaryAdapter = {
  summaryForHousehold(args: {
    actor: PortalActorContext;
    household: HouseholdOverview;
  }): Promise<BillingSummary>;
};

export type LearnerGamificationAdapter = {
  summaryForLearner(args: {
    actor: PortalActorContext;
    learner: LearnerProfile;
  }): Promise<GamificationSummary>;
  classLeaderboard?(args: { actor: PortalActorContext }): Promise<ClassLeaderboardSummary>;
};

export type PortalServiceDeps = {
  repository: PortalRepository;
  classAccess: LearnerClassAccessAdapter;
  contentAccess: LearnerContentAccessAdapter;
  progress: LearnerProgressAdapter;
  gamification?: LearnerGamificationAdapter;
  credentialLifecycle: StudentCredentialLifecycleAdapter;
  updates?: PortalUpdatesAdapter;
  helper?: ScopedPortalHelperAdapter;
  support?: SupportRequestAdapter;
  billing?: BillingSummaryAdapter;
  clock?: () => Date;
  idGenerator?: () => string;
};

const PARENT_HELPER_PREPARING_MESSAGE =
  'Portal helper is being prepared for your household. Send a support request and we will route it for review.';
const STUDENT_HELPER_PREPARING_MESSAGE =
  'Class Helper is being prepared for this class. Send a private question and we will route it for review.';

export function createParentPortalService(deps: PortalServiceDeps) {
  const helper = deps.helper ?? unavailableHelper(PARENT_HELPER_PREPARING_MESSAGE);
  const support = deps.support ?? localSupportPreview(deps.idGenerator);
  const billing = deps.billing ?? disabledBilling();
  const gamification = deps.gamification ?? localGamification();

  return {
    async dashboard(
      actor: PortalActorContext,
      householdKey: string,
    ): Promise<ParentPortalDashboard> {
      requireParentHousehold(actor, householdKey, 'parent:household:read');
      const household = await requireHousehold(deps.repository, actor, householdKey);
      const learners = await deps.repository.listLearners({
        actor,
        household_key: householdKey,
        include_archived: true,
      });
      const visibleLearners = learners.slice(0, 12);
      const studentAccess = await Promise.all(
        visibleLearners.map((learner) =>
          deps.repository.getStudentAccessState({ actor, learner_key: learner.learner_key }),
        ),
      );
      const upcomingEntries = await Promise.all(
        visibleLearners.map(async (learner) => [
          learner.learner_key,
          safeClassSummaries(await deps.classAccess.upcomingForLearner({ actor, learner })),
        ]),
      );
      const rewardEntries = await Promise.all(
        visibleLearners.map(async (learner) => [
          learner.learner_key,
          await deps.repository.getRewardBalance({ actor, learner_key: learner.learner_key }),
        ]),
      );
      const gamificationEntries = await Promise.all(
        visibleLearners.map(async (learner) => [
          learner.learner_key,
          await gamification.summaryForLearner({ actor, learner }),
        ]),
      );
      const updateEntries = await Promise.all(
        visibleLearners.map(async (learner) => [
          learner.learner_key,
          await mergedUpdates(deps.repository, deps, actor, learner, 'parent'),
        ]),
      );
      const leaderboard = await leaderboardFor(gamification, actor);
      return {
        household,
        learners: visibleLearners,
        student_access: studentAccess,
        upcoming_classes: Object.fromEntries(upcomingEntries),
        rewards: Object.fromEntries(rewardEntries),
        gamification: Object.fromEntries(gamificationEntries),
        leaderboard,
        updates: Object.fromEntries(updateEntries),
        helper: await helper.availability({ actor, household }),
        billing: await billing.summaryForHousehold({ actor, household }),
      };
    },

    async createLearner(
      actor: PortalActorContext,
      householdKey: string,
      payload: CreateLearnerPayload,
    ) {
      requireParentHousehold(actor, householdKey, 'parent:learner:create');
      return deps.repository.createLearner({
        actor,
        household_key: householdKey,
        payload,
        request_fingerprint: fingerprint(payload),
      });
    },

    async updateLearner(
      actor: PortalActorContext,
      householdKey: string,
      learnerKey: string,
      payload: UpdateLearnerPayload,
    ) {
      requireParentHousehold(actor, householdKey, 'parent:learner:update');
      await requireLearner(deps.repository, actor, householdKey, learnerKey);
      return deps.repository.updateLearner({
        actor,
        household_key: householdKey,
        learner_key: learnerKey,
        payload,
        request_fingerprint: fingerprint(payload),
      });
    },

    async archiveLearner(
      actor: PortalActorContext,
      householdKey: string,
      learnerKey: string,
      payload: UpdateLearnerPayload,
    ) {
      requireParentHousehold(actor, householdKey, 'parent:learner:archive');
      await requireLearner(deps.repository, actor, householdKey, learnerKey);
      return deps.repository.setLearnerStatus({
        actor,
        household_key: householdKey,
        learner_key: learnerKey,
        status: 'archived',
        version: payload.version,
        idempotency_key: payload.idempotency_key,
        request_fingerprint: fingerprint({ ...payload, status: 'archived' }),
      });
    },

    async restoreLearner(
      actor: PortalActorContext,
      householdKey: string,
      learnerKey: string,
      payload: UpdateLearnerPayload,
    ) {
      requireParentHousehold(actor, householdKey, 'parent:learner:archive');
      await requireLearner(deps.repository, actor, householdKey, learnerKey);
      return deps.repository.setLearnerStatus({
        actor,
        household_key: householdKey,
        learner_key: learnerKey,
        status: 'active',
        version: payload.version,
        idempotency_key: payload.idempotency_key,
        request_fingerprint: fingerprint({ ...payload, status: 'active' }),
      });
    },

    async studentAccessOperation(
      actor: PortalActorContext,
      householdKey: string,
      learnerKey: string,
      operationType: StudentAccessOperationType,
      payload: StudentAccessOperationPayload,
    ) {
      requireParentHousehold(actor, householdKey, 'parent:student-access:manage');
      const learner = await requireLearner(deps.repository, actor, householdKey, learnerKey);
      validateStudentAccessCredentialPayload(operationType, payload);
      const adapterResult = await runCredentialOperation(
        deps.credentialLifecycle,
        operationType,
        actor,
        learner,
        payload,
      );
      assertNoCredentialLeak(adapterResult);
      await deps.repository.recordAudit({
        action_type: `student_access_${operationType}`,
        actor,
        household_key: householdKey,
        learner_key: learnerKey,
        metadata: { adapter_operation_digest: fingerprint(adapterResult.operation_ref) },
      });
      return deps.repository.recordStudentAccessOperation({
        actor,
        learner_key: learnerKey,
        operation_type: operationType,
        idempotency_key: payload.idempotency_key,
        request_fingerprint: fingerprint({ operationType, learnerKey, payload }),
        adapter_result: adapterResult,
      });
    },

    async protectedClassLaunch(
      actor: PortalActorContext,
      householdKey: string,
      learnerKey: string,
      classKey: string,
    ) {
      requireParentHousehold(actor, householdKey, 'parent:class:launch');
      const learner = await requireLearner(deps.repository, actor, householdKey, learnerKey);
      return safeActionDescriptor(
        await deps.classAccess.protectedLaunch({ actor, learner, class_key: classKey }),
      );
    },

    async protectedContentOpen(
      actor: PortalActorContext,
      householdKey: string,
      learnerKey: string,
      itemKey: string,
    ) {
      requireParentHousehold(actor, householdKey, 'parent:content:open');
      const learner = await requireLearner(deps.repository, actor, householdKey, learnerKey);
      return contentOpenForLearner(deps, actor, learner, itemKey);
    },

    async learnerMaterials(actor: PortalActorContext, householdKey: string, learnerKey: string) {
      requireParentHousehold(actor, householdKey, 'parent:household:read');
      const learner = await requireLearner(deps.repository, actor, householdKey, learnerKey);
      const [library, reviewSheets, progress, rewards, gamificationSummary, updates] =
        await Promise.all([
          deps.contentAccess.publishedLibraryForLearner({ actor, learner }),
          deps.contentAccess.reviewSheetsForLearner({ actor, learner }),
          deps.progress.progressForLearner({ actor, learner }),
          deps.repository.getRewardBalance({ actor, learner_key: learnerKey }),
          gamification.summaryForLearner({ actor, learner }),
          mergedUpdates(deps.repository, deps, actor, learner, 'parent'),
        ]);
      return {
        learner,
        library: safeLibraryItems(library),
        review_sheets: safeLibraryItems(reviewSheets),
        progress,
        rewards,
        gamification: gamificationSummary,
        updates,
      };
    },

    async helperAvailability(actor: PortalActorContext, householdKey: string) {
      requireParentHousehold(actor, householdKey, 'parent:household:read');
      const household = await requireHousehold(deps.repository, actor, householdKey);
      return helper.availability({ actor, household });
    },

    async helperQuery(
      actor: PortalActorContext,
      householdKey: string,
      payload: HelperQueryPayload,
    ) {
      requireParentHousehold(actor, householdKey, 'helper:query');
      if (!helper.query) {
        throw new PortalServiceError('ADAPTER_UNAVAILABLE', PARENT_HELPER_PREPARING_MESSAGE);
      }
      const household = await requireHousehold(deps.repository, actor, householdKey);
      return helper.query({ actor, household, payload });
    },

    async supportPreview(
      actor: PortalActorContext,
      householdKey: string,
      payload: SupportRequestPayload,
    ) {
      requireParentHousehold(actor, householdKey, 'parent:support:preview');
      const household = await requireHousehold(deps.repository, actor, householdKey);
      return support.preview({ actor, household, payload });
    },
  };
}

export function createStudentPortalService(deps: PortalServiceDeps) {
  const helper = deps.helper ?? unavailableHelper(STUDENT_HELPER_PREPARING_MESSAGE);
  const support = deps.support ?? localSupportPreview(deps.idGenerator);
  const gamification = deps.gamification ?? localGamification();

  return {
    async dashboard(actor: PortalActorContext): Promise<StudentPortalDashboard> {
      const subject = requireStudentSubject(actor, 'student:dashboard:read');
      const learner = await requireLearner(
        deps.repository,
        actor,
        subject.household_key,
        subject.learner_key,
      );
      const [
        upcoming,
        library,
        reviewSheets,
        progress,
        rewards,
        gamificationSummary,
        updates,
        questions,
        helperState,
        leaderboard,
      ] = await Promise.all([
        deps.classAccess.upcomingForLearner({ actor, learner }),
        deps.contentAccess.publishedLibraryForLearner({ actor, learner }),
        deps.contentAccess.reviewSheetsForLearner({ actor, learner }),
        deps.progress.progressForLearner({ actor, learner }),
        deps.repository.getRewardBalance({ actor, learner_key: learner.learner_key }),
        gamification.summaryForLearner({ actor, learner }),
        mergedUpdates(deps.repository, deps, actor, learner, 'student'),
        deps.repository.listStudentQuestions({ actor, learner_key: learner.learner_key }),
        helper.availability({ actor, learner }),
        leaderboardFor(gamification, actor),
      ]);
      const safeLibrary = safeLibraryItems([...library, ...reviewSheets]);
      return {
        learner,
        upcoming_classes: safeClassSummaries(upcoming),
        library_items: safeLibrary,
        featured_lesson: safeLibrary.find((item) => item.lesson?.featured)?.lesson ?? null,
        leaderboard,
        progress,
        rewards,
        gamification: gamificationSummary,
        updates,
        questions,
        helper: helperState,
      };
    },

    async protectedClassLaunch(
      actor: PortalActorContext,
      classKey: string,
      payload: { idempotency_key?: string | undefined } = {},
    ) {
      const subject = requireStudentSubject(actor, 'student:class:launch');
      const learner = await requireLearner(
        deps.repository,
        actor,
        subject.household_key,
        subject.learner_key,
      );
      return safeActionDescriptor(
        await deps.classAccess.protectedLaunch({
          actor,
          learner,
          class_key: classKey,
          ...(payload.idempotency_key ? { idempotency_key: payload.idempotency_key } : {}),
        }),
      );
    },

    async protectedContentOpen(actor: PortalActorContext, itemKey: string) {
      const subject = requireStudentSubject(actor, 'student:content:open');
      const learner = await requireLearner(
        deps.repository,
        actor,
        subject.household_key,
        subject.learner_key,
      );
      return contentOpenForLearner(deps, actor, learner, itemKey);
    },

    async helperAvailability(actor: PortalActorContext) {
      const subject = requireStudentSubject(actor, 'student:dashboard:read');
      const learner = await requireLearner(
        deps.repository,
        actor,
        subject.household_key,
        subject.learner_key,
      );
      return helper.availability({ actor, learner });
    },

    async helperQuery(actor: PortalActorContext, payload: HelperQueryPayload) {
      const subject = requireStudentSubject(actor, 'helper:query');
      if (!helper.query) {
        throw new PortalServiceError('ADAPTER_UNAVAILABLE', STUDENT_HELPER_PREPARING_MESSAGE);
      }
      const learner = await requireLearner(
        deps.repository,
        actor,
        subject.household_key,
        subject.learner_key,
      );
      return helper.query({ actor, learner, payload });
    },

    async supportPreview(actor: PortalActorContext, payload: SupportRequestPayload) {
      const subject = requireStudentSubject(actor, 'student:support:preview');
      const learner = await requireLearner(
        deps.repository,
        actor,
        subject.household_key,
        subject.learner_key,
      );
      return support.preview({ actor, learner, payload });
    },

    async submitQuestion(actor: PortalActorContext, payload: StudentQuestionPayload) {
      const subject = requireStudentSubject(actor, 'student:question:create');
      await requireLearner(deps.repository, actor, subject.household_key, subject.learner_key);
      return deps.repository.submitStudentQuestion({
        actor,
        learner_key: subject.learner_key,
        payload,
        request_fingerprint: fingerprint(payload),
      });
    },

    async questions(actor: PortalActorContext) {
      const subject = requireStudentSubject(actor, 'student:dashboard:read');
      await requireLearner(deps.repository, actor, subject.household_key, subject.learner_key);
      return deps.repository.listStudentQuestions({
        actor,
        learner_key: subject.learner_key,
      });
    },
  };
}

export function createRewardService(repository: PortalRepository) {
  return {
    async award(actor: PortalActorContext, input: RewardWriteInput) {
      if (actor.actor_role === 'student') {
        throw new PortalServiceError('FORBIDDEN', 'Students cannot change rewards.');
      }
      if (!hasPortalCapability(actor, 'rewards:write')) {
        throw new PortalServiceError('FORBIDDEN', 'This account cannot change rewards.');
      }
      const sourceType = actor.actor_role === 'parent' ? 'parent_capability' : 'admin';
      return repository.addRewardEvent({
        actor,
        input,
        source_type: sourceType,
        request_fingerprint: fingerprint(input),
      });
    },
  };
}

export function fingerprint(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(sortForHash(value)))
    .digest('hex');
}

function sortForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForHash);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortForHash(entry)]),
    );
  }
  return value;
}

function requireParentHousehold(
  actor: PortalActorContext,
  householdKey: string,
  capability: PortalCapability,
) {
  if (actor.actor_role !== 'parent') {
    throw new PortalServiceError('FORBIDDEN', 'This portal action requires a parent session.');
  }
  if (!hasPortalCapability(actor, capability)) {
    throw new PortalServiceError('FORBIDDEN', 'This parent session cannot perform that action.');
  }
  const match = actor.authorized_households.find(
    (subject) => subject.household_key === householdKey && subject.authority !== 'support_only',
  );
  if (!match) {
    throw new PortalServiceError('NOT_FOUND', 'The requested portal record was not found.');
  }
}

function requireStudentSubject(actor: PortalActorContext, capability: PortalCapability) {
  if (actor.actor_role !== 'student' || !actor.student_learner) {
    throw new PortalServiceError('FORBIDDEN', 'This portal action requires a student session.');
  }
  if (!hasPortalCapability(actor, capability)) {
    throw new PortalServiceError('FORBIDDEN', 'This student session cannot perform that action.');
  }
  return actor.student_learner;
}

async function requireHousehold(
  repository: PortalRepository,
  actor: PortalActorContext,
  householdKey: string,
) {
  const household = await repository.getHousehold({ actor, household_key: householdKey });
  if (!household) {
    throw new PortalServiceError('NOT_FOUND', 'The requested portal record was not found.');
  }
  return household;
}

async function requireLearner(
  repository: PortalRepository,
  actor: PortalActorContext,
  householdKey: string,
  learnerKey: string,
) {
  const learner = await repository.getLearner({
    actor,
    household_key: householdKey,
    learner_key: learnerKey,
  });
  if (!learner) {
    throw new PortalServiceError('NOT_FOUND', 'The requested portal record was not found.');
  }
  return learner;
}

async function mergedUpdates(
  repository: PortalRepository,
  deps: PortalServiceDeps,
  actor: PortalActorContext,
  learner: LearnerProfile,
  audience: 'parent' | 'student',
) {
  const local = await repository.listUpdates({ actor, learner_key: learner.learner_key, audience });
  const external = deps.updates?.externalUpdatesForLearner
    ? await deps.updates.externalUpdatesForLearner({ actor, learner, audience })
    : [];
  return [...local, ...external];
}

async function runCredentialOperation(
  adapter: StudentCredentialLifecycleAdapter,
  operationType: StudentAccessOperationType,
  actor: PortalActorContext,
  learner: LearnerProfile,
  payload: StudentAccessOperationPayload,
) {
  if (operationType === 'setup') return adapter.requestSetup({ actor, learner, payload });
  if (operationType === 'reset') return adapter.requestReset({ actor, learner, payload });
  if (operationType === 'suspend') return adapter.requestSuspend({ actor, learner, payload });
  if (operationType === 'restore') return adapter.requestRestore({ actor, learner, payload });
  return adapter.requestRevokeSessions({ actor, learner, payload });
}

function assertNoCredentialLeak(result: CredentialLifecycleResult) {
  const stack: unknown[] = [result];
  while (stack.length > 0) {
    const entry = stack.pop();
    if (Array.isArray(entry)) {
      stack.push(...entry);
      continue;
    }
    if (entry && typeof entry === 'object') {
      stack.push(...Object.values(entry as Record<string, unknown>));
      continue;
    }
    if (typeof entry !== 'string') continue;
    const normalized = entry.toLowerCase();
    if (
      /^https?:\/\//.test(normalized) ||
      normalized.includes('raw_join_url') ||
      normalized.includes('raw_private_url') ||
      normalized.includes('plain_password') ||
      normalized.includes('password:')
    ) {
      throw new PortalServiceError(
        'SERVER_ERROR',
        'Credential lifecycle adapter returned forbidden credential material.',
      );
    }
  }
}

function validateStudentAccessCredentialPayload(
  operationType: StudentAccessOperationType,
  payload: StudentAccessOperationPayload,
) {
  if (operationType !== 'setup' && operationType !== 'reset') return;
  if (operationType === 'setup' && !payload.username) {
    throw new PortalServiceError('VALIDATION_ERROR', 'Student username is required for setup.');
  }
  if (!payload.password) {
    throw new PortalServiceError('PASSWORD_POLICY_FAILED', 'Student password is required.');
  }
  if (
    payload.username &&
    reservedStudentUsernames.has(normalizeStudentUsername(payload.username))
  ) {
    throw new PortalServiceError('USERNAME_UNAVAILABLE', 'Choose a different student username.');
  }
}

const reservedStudentUsernames = new Set([
  'admin',
  'administrator',
  'billing',
  'parent',
  'rabbi',
  'root',
  'student',
  'support',
]);

async function leaderboardFor(gamification: LearnerGamificationAdapter, actor: PortalActorContext) {
  return gamification.classLeaderboard ? gamification.classLeaderboard({ actor }) : undefined;
}

async function contentOpenForLearner(
  deps: PortalServiceDeps,
  actor: PortalActorContext,
  learner: LearnerProfile,
  itemKey: string,
) {
  const [library, reviewSheets] = await Promise.all([
    deps.contentAccess.publishedLibraryForLearner({ actor, learner }),
    deps.contentAccess.reviewSheetsForLearner({ actor, learner }),
  ]);
  const item = safeLibraryItems([...library, ...reviewSheets]).find(
    (entry) => entry.item_key === itemKey,
  );
  if (!item?.open_action) {
    throw new PortalServiceError('NOT_FOUND', 'The requested portal record was not found.');
  }
  if (item.content_factory) {
    return {
      ...item.open_action,
      label: 'Open approved class video',
      href: item.content_factory.playback_route,
      launch_token_ref: null,
    };
  }
  return protectedContentUnavailableAction(learner, item);
}

function protectedContentUnavailableAction(
  learner: LearnerProfile,
  item: LibraryItem,
): ProtectedActionDescriptor {
  const kind =
    item.item_type === 'sheet' || item.item_type === 'review'
      ? 'review_sheet_open'
      : 'content_open';
  const digest = fingerprint({
    learner_key: learner.learner_key,
    item_key: item.item_key,
    kind,
  }).slice(0, 32);
  return {
    action_key: `portal_${kind}_${digest}`,
    label:
      kind === 'review_sheet_open'
        ? 'Review sheet provider unavailable'
        : 'Content provider unavailable',
    kind,
    method: 'GET',
    href: null,
    launch_token_ref: `content_unavailable_${digest}`,
    expires_at: null,
  };
}

function safeClassSummaries(classes: UpcomingClassSummary[]) {
  return classes.map((classSummary) => ({
    ...classSummary,
    launch_action: classSummary.launch_action
      ? safeActionDescriptor(classSummary.launch_action)
      : null,
  }));
}

function safeLibraryItems(items: LibraryItem[]) {
  return items.map((item) => ({
    ...item,
    open_action: item.open_action ? safeActionDescriptor(item.open_action) : null,
  }));
}

function safeActionDescriptor(action: ProtectedActionDescriptor) {
  if (action.href && !action.href.startsWith('/')) {
    throw new PortalServiceError(
      'SERVER_ERROR',
      'Portal adapter returned a raw external provider URL.',
    );
  }
  if (action.launch_token_ref && /https?:\/\//i.test(action.launch_token_ref)) {
    throw new PortalServiceError(
      'SERVER_ERROR',
      'Portal adapter returned a raw external provider URL.',
    );
  }
  return action;
}

function unavailableHelper(reason: string): ScopedPortalHelperAdapter {
  return {
    availability: async () => ({ available: false, reason, scope_label: 'Portal helper' }),
  };
}

function localSupportPreview(idGenerator?: () => string): SupportRequestAdapter {
  return {
    preview: async ({ payload }) => ({
      preview_key: idGenerator?.() ?? `support_preview_${randomUUID()}`,
      subject: payload.subject,
      body: payload.body,
      external_send_performed: false,
    }),
  };
}

function disabledBilling(): BillingSummaryAdapter {
  return {
    summaryForHousehold: async () => ({ enabled: false, summary_label: null }),
  };
}

function localGamification(): LearnerGamificationAdapter {
  return {
    summaryForLearner: async ({ actor, learner }) => ({
      learner_key: learner.learner_key,
      learning_points: 0,
      level: {
        level: 1,
        title: 'Getting Started',
        min_points: 0,
        next_level_points: 50,
        progress_percent: 0,
      },
      progress: {
        mishnayos_completed: 0,
        mishnayos_target: 24,
        classes_attended: 0,
        classes_total: 0,
        review_items_completed: 0,
        review_items_total: 0,
        retention_reviews_completed: 0,
        retention_percent: 0,
      },
      streaks: [
        {
          kind: 'attendance',
          current_count: 0,
          best_count: 0,
          grace_remaining: 2,
          last_earned_at: null,
          status: 'empty',
        },
        {
          kind: 'review',
          current_count: 0,
          best_count: 0,
          grace_remaining: 2,
          last_earned_at: null,
          status: 'empty',
        },
      ],
      badges: [],
      milestones: [],
      accomplishments: [],
      parent_rewards: [],
      class_milestones: [],
      celebration: null,
      guardrails: {
        no_public_rankings: true,
        leaderboard_scope: 'authenticated_class_only',
        leaderboard_time_basis: 'all_time_no_reset',
        no_negative_labels: true,
        no_random_rewards: true,
        meaningful_learning_only: true,
        rabbi_corrections_audited: true,
        publication_controlled_by_rabbi: true,
        student_scope:
          actor.actor_role === 'student'
            ? 'self_only'
            : actor.actor_role === 'parent'
              ? 'household'
              : 'authorized_staff',
      },
    }),
    classLeaderboard: async () => ({
      board_key: 'leaderboard_one_time_daily_empty',
      class_series_key: 'class_series_one_time_daily',
      title: 'Daily One Time Mishnayos',
      scope: 'authenticated_class_only',
      time_basis: 'all_time_no_reset',
      published: false,
      actual_names_visible: true,
      negative_labels_present: false,
      ai_judgment_present: false,
      corrected_by_rabbi_audit_available: true,
      updated_at: null,
      entries: [],
    }),
  };
}
