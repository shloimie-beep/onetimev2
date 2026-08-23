import { createHash } from 'node:crypto';
import {
  FAMILY_CHILD_STUDENT_LIMIT,
  FAMILY_PARENT_LEARNER_COUNT,
  FAMILY_TOTAL_LEARNER_CAPACITY,
  PARENT_LEARNER_ORDINAL,
  PARENT_LEARNING_CONTRACT_VERSION,
  PARENT_LEARNING_ERROR_CODES,
  type ParentAttendanceWrite,
  type ParentContentProgressWrite,
  type ParentLearningActionDescriptor,
  type ParentLearningContentOpenTarget,
  type ParentLearningContentProgressTarget,
  type ParentLearningMutationContext,
  type ParentLearningPrincipal,
  type ParentLearningProductionBasicActor,
  type ParentLearningRecord,
  type ParentLearningSnapshot,
  type ParentQuestionWrite,
  type RecordParentAttendanceEvidence,
  type RecordParentContentProgressCommand,
  type SubmitParentQuestionCommand,
} from '../../../../contracts/src/portals/parent-learning/index.ts';
import { ParentLearningError } from './errors.ts';

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

export function buildParentLearningSnapshot(input: {
  principal: ParentLearningPrincipal;
  record: ParentLearningRecord;
}): ParentLearningSnapshot {
  assertOwnedActiveParticipant(input.principal, input.record);
  const activeChildren = nonNegativeInteger(
    input.record.active_child_student_count,
    'active child Student count',
  );
  if (activeChildren > FAMILY_CHILD_STUDENT_LIMIT) {
    invalid('The Family child Student count exceeds the three-child limit.');
  }
  assertActivity(input.record);
  return {
    contract_version: PARENT_LEARNING_CONTRACT_VERSION,
    participant_id: input.record.participant_id,
    household_id: input.record.household_id,
    display_name: requiredText(input.record.display_name, 'Parent display name'),
    state: 'active',
    learner_ordinal: PARENT_LEARNER_ORDINAL,
    capacity: {
      total_learners: FAMILY_TOTAL_LEARNER_CAPACITY,
      parent_learners: FAMILY_PARENT_LEARNER_COUNT,
      child_student_limit: FAMILY_CHILD_STUDENT_LIMIT,
      active_child_students: activeChildren,
      available_child_student_seats: FAMILY_CHILD_STUDENT_LIMIT - activeChildren,
    },
    class_entitlement: {
      class_series_key: input.record.entitlement.class_series_key,
      class_title: input.record.entitlement.class_title,
      effective_at: input.record.entitlement.effective_at,
    },
    next_class: input.record.next_class
      ? {
          ...input.record.next_class,
          launch_action: input.record.next_class.launch_action
            ? exactProductionBasicLaunchAction(input.record.next_class.launch_action)
            : null,
        }
      : null,
    library_items: input.record.library_items.map((item) => {
      const contentId = identifier(item.content_id, 'content');
      identifier(item.content_version_id, 'content version');
      requiredText(item.title, 'content title');
      instant(item.published_at, 'content publication time');
      if (item.item_type !== 'video') {
        invalid('The Parent content type is invalid.');
      }
      if (item.progress) {
        const position = nonNegativeInteger(item.progress.position_ms, 'content position');
        const duration = nonNegativeInteger(item.progress.duration_ms, 'content duration');
        if (duration <= 0 || position > duration) {
          invalid('The Parent content progress is outside the recording duration.');
        }
        if (item.progress.completed && position < duration) {
          invalid('Completed Parent content progress must reach the recording duration.');
        }
        instant(item.progress.updated_at, 'content progress time');
      }
      const expectedOpenPath = `/api/v1/portals/parent/learning/content/${encodeURIComponent(
        contentId,
      )}/open`;
      const openAction = safeAction(item.open_action, 'content_open', 'GET');
      if (openAction.href !== expectedOpenPath || openAction.launch_token_ref !== null) {
        invalid('The Parent content action is invalid.');
      }
      return {
        ...item,
        progress: item.progress ? { ...item.progress } : null,
        open_action: openAction,
      };
    }),
    activity: { ...input.record.activity },
  };
}

export function buildParentLearningProductionBasicActor(input: {
  principal: ParentLearningPrincipal;
  record: ParentLearningRecord;
}): ParentLearningProductionBasicActor {
  assertOwnedActiveParticipant(input.principal, input.record);
  return {
    kind: 'parent',
    scope: {
      account_key: input.record.entitlement.account_key,
      product_key: 'one_time_mishnayos',
    },
    participant_id: input.record.participant_id,
    household_id: input.record.household_id,
    display_name: requiredText(input.record.display_name, 'Parent display name'),
    entitled: true,
  };
}

export function buildParentContentPlaybackAction(
  target: ParentLearningContentOpenTarget,
): ParentLearningActionDescriptor {
  const contentId = identifier(target.content_id, 'content');
  if (target.item_type !== 'video') {
    invalid('The Parent content type is invalid.');
  }
  return safeAction(
    {
      action_key: stableActionKey('parent-content-play', contentId),
      label: 'Play video',
      kind: 'content_open',
      method: 'GET',
      href: `/app/learning/items/${encodeURIComponent(contentId)}`,
      launch_token_ref: null,
      expires_at: null,
    },
    'content_open',
    'GET',
  );
}

export function prepareParentAttendance(input: {
  principal: ParentLearningPrincipal;
  record: ParentLearningRecord;
  command: RecordParentAttendanceEvidence;
  context: ParentLearningMutationContext;
}): ParentAttendanceWrite {
  assertOwnedActiveParticipant(input.principal, input.record);
  assertContext(input.context);
  identifier(input.command.occurrence_id, 'class occurrence');
  identifier(input.command.connection_lineage_id, 'connection lineage');
  if (input.command.event_kind !== 'joined' && input.command.event_kind !== 'left') {
    invalid('The Parent attendance event is invalid.');
  }
  if (!SHA256.test(input.command.source_event_ref_digest)) {
    invalid('The Parent attendance source digest is invalid.');
  }
  return {
    participant_id: input.record.participant_id,
    household_id: input.record.household_id,
    actor_kind: 'parent',
    ...input.command,
    context: { ...input.context },
  };
}

export function prepareParentContentProgress(input: {
  principal: ParentLearningPrincipal;
  record: ParentLearningRecord;
  target: ParentLearningContentProgressTarget;
  command: RecordParentContentProgressCommand;
  context: ParentLearningMutationContext;
}): ParentContentProgressWrite {
  assertOwnedActiveParticipant(input.principal, input.record);
  assertContext(input.context);
  const contentId = identifier(input.command.content_id, 'content');
  const contentVersionId = identifier(input.command.content_version_id, 'content version');
  if (
    contentId !== identifier(input.target.content_id, 'governed content') ||
    contentVersionId !== identifier(input.target.content_version_id, 'governed content version')
  ) {
    throw new ParentLearningError(
      PARENT_LEARNING_ERROR_CODES.targetUnavailable,
      'This Parent content version is unavailable.',
    );
  }
  const position = nonNegativeInteger(input.command.position_ms, 'content position');
  const submittedDuration = nonNegativeInteger(input.command.duration_ms, 'content duration');
  const duration = nonNegativeInteger(input.target.duration_ms, 'governed content duration');
  if (duration <= 0 || submittedDuration !== duration || position > duration) {
    invalid('The Parent content progress is outside the recording duration.');
  }
  const completed = position === duration;
  if (input.command.completed !== completed) {
    invalid('Parent content completion must match the governed recording duration.');
  }
  return {
    participant_id: input.record.participant_id,
    household_id: input.record.household_id,
    actor_kind: 'parent',
    ...input.command,
    content_id: contentId,
    content_version_id: contentVersionId,
    position_ms: position,
    duration_ms: duration,
    completed,
    context: { ...input.context },
  };
}

export function prepareParentQuestion(input: {
  principal: ParentLearningPrincipal;
  record: ParentLearningRecord;
  command: SubmitParentQuestionCommand;
  context: ParentLearningMutationContext;
}): ParentQuestionWrite {
  assertOwnedActiveParticipant(input.principal, input.record);
  assertContext(input.context);
  const classSeriesKey = identifier(input.command.class_series_key, 'class series');
  if (classSeriesKey !== input.record.entitlement.class_series_key) {
    throw new ParentLearningError(
      PARENT_LEARNING_ERROR_CODES.targetUnavailable,
      'This Parent class is unavailable.',
    );
  }
  const privateBody = requiredText(input.command.private_body, 'Question');
  if (privateBody.length > 4_000) invalid('The Parent question is too long.');
  return {
    participant_id: input.record.participant_id,
    household_id: input.record.household_id,
    actor_kind: 'parent',
    class_series_key: classSeriesKey,
    private_body: privateBody,
    context: { ...input.context },
  };
}

function assertOwnedActiveParticipant(
  principal: ParentLearningPrincipal,
  record: ParentLearningRecord,
) {
  if (
    principal.role !== 'parent' ||
    !principal.adult_id ||
    !principal.human_account_id ||
    !principal.household_id ||
    !principal.session_id
  ) {
    throw new ParentLearningError(
      PARENT_LEARNING_ERROR_CODES.roleDenied,
      'A signed-in Parent account is required.',
    );
  }
  if (
    record.adult_id !== principal.adult_id ||
    record.human_account_id !== principal.human_account_id ||
    record.household_id !== principal.household_id ||
    record.state !== 'active' ||
    record.learner_ordinal !== PARENT_LEARNER_ORDINAL
  ) {
    throw new ParentLearningError(
      PARENT_LEARNING_ERROR_CODES.scopeDenied,
      'This Parent learning participant is unavailable.',
    );
  }
  identifier(record.participant_id, 'Parent participant');
  identifier(record.entitlement.account_key, 'class account');
  identifier(record.entitlement.class_series_key, 'class series');
  requiredText(record.entitlement.class_title, 'class title');
  instant(record.entitlement.effective_at, 'class entitlement time');
}

function assertActivity(record: ParentLearningRecord) {
  nonNegativeInteger(record.activity.attended_occurrence_count, 'attendance count');
  nonNegativeInteger(record.activity.started_content_count, 'started content count');
  nonNegativeInteger(record.activity.completed_content_count, 'completed content count');
  nonNegativeInteger(record.activity.submitted_question_count, 'question count');
  if (record.activity.completed_content_count > record.activity.started_content_count) {
    invalid('Completed Parent content cannot exceed started content.');
  }
}

function exactProductionBasicLaunchAction(
  action: ParentLearningActionDescriptor,
): ParentLearningActionDescriptor {
  const safe = safeAction(action, 'class_launch', 'POST');
  if (
    safe.href !== '/api/v1/portals/parent/classroom/production-basic/launch' ||
    safe.launch_token_ref !== null ||
    safe.expires_at === null
  ) {
    invalid('The Parent classroom launch action is invalid.');
  }
  instant(safe.expires_at, 'Parent classroom launch expiry');
  return safe;
}

function safeAction(
  action: ParentLearningActionDescriptor,
  kind: ParentLearningActionDescriptor['kind'],
  method: ParentLearningActionDescriptor['method'],
): ParentLearningActionDescriptor {
  identifier(action.action_key, 'Parent learning action');
  requiredText(action.label, 'Parent learning action label');
  if (
    action.kind !== kind ||
    action.method !== method ||
    !action.href.startsWith('/') ||
    action.href.startsWith('//') ||
    /[\\\r\n]/u.test(action.href) ||
    /https?:\/\//iu.test(action.href) ||
    (action.launch_token_ref !== null && !IDENTIFIER.test(action.launch_token_ref))
  ) {
    invalid('The Parent learning action is invalid.');
  }
  if (action.expires_at !== null) instant(action.expires_at, 'Parent learning action expiry');
  return { ...action };
}

function stableActionKey(prefix: string, value: string) {
  return `${prefix}:${createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 40)}`;
}

function assertContext(context: ParentLearningMutationContext) {
  if (!IDEMPOTENCY_KEY.test(context.idempotency_key)) {
    invalid('A valid Parent learning idempotency key is required.');
  }
  if (!SHA256.test(context.canonical_request_hash)) {
    invalid('The Parent learning request hash is invalid.');
  }
  instant(context.occurred_at, 'Parent learning event time');
}

function identifier(value: string, label: string) {
  const normalized = requiredText(value, label);
  if (!IDENTIFIER.test(normalized)) invalid(`${label} is invalid.`);
  return normalized;
}

function requiredText(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) invalid(`${label} is required.`);
  return normalized;
}

function nonNegativeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) invalid(`${label} is invalid.`);
  return value;
}

function instant(value: string, label: string) {
  if (!value || Number.isNaN(Date.parse(value))) invalid(`${label} is invalid.`);
}

function invalid(message: string): never {
  throw new ParentLearningError(PARENT_LEARNING_ERROR_CODES.invalidInput, message);
}
