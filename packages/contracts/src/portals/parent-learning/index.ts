export const PARENT_LEARNING_CONTRACT_VERSION = '1.0.0' as const;
export const FAMILY_PARENT_LEARNER_COUNT = 1 as const;
export const FAMILY_CHILD_STUDENT_LIMIT = 3 as const;
export const FAMILY_TOTAL_LEARNER_CAPACITY = 4 as const;
export const PARENT_LEARNER_ORDINAL = 1 as const;

export type ParentLearningPrincipal = {
  role: 'parent';
  adult_id: string;
  human_account_id: string;
  household_id: string;
  session_id: string;
};

export type ParentLearningClassEntitlement = {
  class_series_key: string;
  class_title: string;
  effective_at: string;
};

export type ParentLearningActionDescriptor = {
  action_key: string;
  label: string;
  kind: 'class_launch' | 'content_open';
  method: 'POST' | 'GET';
  href: string;
  launch_token_ref: string | null;
  expires_at: string | null;
};

export type ParentLearningNextClass = {
  occurrence_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  join_opens_at: string;
  join_closes_at: string;
  state: 'scheduled' | 'preparing' | 'ready' | 'live';
  launch_action: ParentLearningActionDescriptor | null;
};

export type ParentLearningContentProgress = {
  position_ms: number;
  duration_ms: number;
  completed: boolean;
  updated_at: string;
};

export type ParentLearningLibraryItem = {
  content_id: string;
  content_version_id: string;
  title: string;
  item_type: 'video';
  published_at: string;
  progress: ParentLearningContentProgress | null;
  open_action: ParentLearningActionDescriptor;
};

export type ParentLearningActivitySummary = {
  attended_occurrence_count: number;
  started_content_count: number;
  completed_content_count: number;
  submitted_question_count: number;
};

export type ParentLearningRecord = {
  participant_id: string;
  adult_id: string;
  human_account_id: string;
  household_id: string;
  display_name: string;
  state: 'active';
  learner_ordinal: typeof PARENT_LEARNER_ORDINAL;
  active_child_student_count: number;
  entitlement: ParentLearningClassEntitlement & { account_key: string };
  next_class: ParentLearningNextClass | null;
  library_items: ParentLearningLibraryItem[];
  activity: ParentLearningActivitySummary;
};

export type ParentLearningSnapshot = {
  contract_version: typeof PARENT_LEARNING_CONTRACT_VERSION;
  participant_id: string;
  household_id: string;
  display_name: string;
  state: 'active';
  learner_ordinal: typeof PARENT_LEARNER_ORDINAL;
  capacity: {
    total_learners: typeof FAMILY_TOTAL_LEARNER_CAPACITY;
    parent_learners: typeof FAMILY_PARENT_LEARNER_COUNT;
    child_student_limit: typeof FAMILY_CHILD_STUDENT_LIMIT;
    active_child_students: number;
    available_child_student_seats: number;
  };
  class_entitlement: ParentLearningClassEntitlement;
  next_class: ParentLearningNextClass | null;
  library_items: ParentLearningLibraryItem[];
  activity: ParentLearningActivitySummary;
};

export type ParentLearningContentOpenTarget = {
  content_id: string;
  item_type: ParentLearningLibraryItem['item_type'];
};

export type ParentLearningContentProgressTarget = {
  content_id: string;
  content_version_id: string;
  duration_ms: number;
};

export type ParentLearningProductionBasicActor = {
  kind: 'parent';
  scope: { account_key: string; product_key: 'one_time_mishnayos' };
  participant_id: string;
  household_id: string;
  display_name: string;
  entitled: true;
};

export type ParentLearningMutationContext = {
  idempotency_key: string;
  canonical_request_hash: string;
  occurred_at: string;
};

export type RecordParentAttendanceCommand = {
  occurrence_id: string;
  event_kind: 'joined' | 'left';
  connection_lineage_id: string;
};

export type RecordParentAttendanceEvidence = RecordParentAttendanceCommand & {
  source_event_ref_digest: string;
};

export type RecordParentContentProgressCommand = {
  content_id: string;
  content_version_id: string;
  position_ms: number;
  duration_ms: number;
  completed: boolean;
};

export type SubmitParentQuestionCommand = {
  class_series_key: string;
  private_body: string;
};

type ParentLearningWriteBase = {
  participant_id: string;
  household_id: string;
  actor_kind: 'parent';
  context: ParentLearningMutationContext;
};

export type ParentAttendanceWrite = ParentLearningWriteBase & RecordParentAttendanceEvidence;
export type ParentContentProgressWrite = ParentLearningWriteBase &
  RecordParentContentProgressCommand;
export type ParentQuestionWrite = ParentLearningWriteBase & SubmitParentQuestionCommand;

export type ParentLearningMutationOperation =
  'attendance_recorded' | 'content_progress_recorded' | 'question_submitted';

export type ParentLearningMutationReceipt = {
  disposition: 'committed' | 'replayed';
  operation: ParentLearningMutationOperation;
  entity_id: string;
};

export interface ParentLearningRepository {
  loadOwnedParticipant(principal: ParentLearningPrincipal): Promise<ParentLearningRecord | null>;
  loadContentOpenTarget(input: {
    principal: ParentLearningPrincipal;
    participant_id: string;
    content_id: string;
  }): Promise<ParentLearningContentOpenTarget | null>;
  loadContentProgressTarget(input: {
    principal: ParentLearningPrincipal;
    participant_id: string;
    content_id: string;
    content_version_id: string;
  }): Promise<ParentLearningContentProgressTarget | null>;
  recordAttendance(input: {
    principal: ParentLearningPrincipal;
    write: ParentAttendanceWrite;
  }): Promise<ParentLearningMutationReceipt>;
  recordContentProgress(input: {
    principal: ParentLearningPrincipal;
    write: ParentContentProgressWrite;
  }): Promise<ParentLearningMutationReceipt>;
  submitQuestion(input: {
    principal: ParentLearningPrincipal;
    write: ParentQuestionWrite;
  }): Promise<ParentLearningMutationReceipt>;
}

export const PARENT_LEARNING_ERROR_CODES = {
  roleDenied: 'parent_learning_role_denied',
  scopeDenied: 'parent_learning_scope_denied',
  missing: 'parent_learning_missing',
  invalidInput: 'parent_learning_input_invalid',
  targetUnavailable: 'parent_learning_target_unavailable',
  idempotencyConflict: 'parent_learning_idempotency_conflict',
  persistenceInvariant: 'parent_learning_persistence_invariant',
} as const;

export type ParentLearningErrorCode =
  (typeof PARENT_LEARNING_ERROR_CODES)[keyof typeof PARENT_LEARNING_ERROR_CODES];
