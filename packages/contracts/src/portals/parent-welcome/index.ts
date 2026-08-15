export const PARENT_WELCOME_VIDEO_CONTRACT_VERSION = '1.0.0' as const;
export const PARENT_WELCOME_VIDEO_SLOT_KEY = 'parent_companion_welcome' as const;
export const PARENT_WELCOME_VIDEO_UNBOUND_VERSION = 'unbound' as const;

export const PARENT_WELCOME_BROWSER_EVENT_TYPES = [
  'parent.welcome_video_impression',
  'parent.welcome_video_started',
  'parent.welcome_video_10_seconds',
  'parent.welcome_video_25_percent',
  'parent.welcome_video_50_percent',
  'parent.welcome_video_75_percent',
  'parent.welcome_video_completed',
  'parent.add_student_clicked',
] as const;

export const PARENT_WELCOME_FUNNEL_EVENT_TYPES = [
  'family.account_created',
  'parent.portal_opened',
  'parent.welcome_video_impression',
  'parent.welcome_video_started',
  'parent.welcome_video_10_seconds',
  'parent.companion_activated',
  'parent.welcome_video_25_percent',
  'parent.welcome_video_50_percent',
  'parent.welcome_video_75_percent',
  'parent.welcome_video_completed',
  'parent.add_student_clicked',
  'student.created',
  'student.first_learning_started',
  'family.engaged',
] as const;

export type ParentWelcomeBrowserEventType = (typeof PARENT_WELCOME_BROWSER_EVENT_TYPES)[number];
export type ParentWelcomeFunnelEventType = (typeof PARENT_WELCOME_FUNNEL_EVENT_TYPES)[number];
export type ParentWelcomeStoredEventType =
  ParentWelcomeBrowserEventType | ParentWelcomeFunnelEventType;

export type ParentWelcomePrincipal = {
  role: 'parent';
  adult_id: string;
  household_id: string;
  session_id: string;
};

export type ParentWelcomeVideoUnavailable = {
  contract_version: typeof PARENT_WELCOME_VIDEO_CONTRACT_VERSION;
  status: 'unavailable';
  reason: 'no_approved_version';
  title: 'Welcome to One Time';
  message: string;
};

export type ParentWelcomeVideoReady = {
  contract_version: typeof PARENT_WELCOME_VIDEO_CONTRACT_VERSION;
  status: 'ready';
  slot_key: typeof PARENT_WELCOME_VIDEO_SLOT_KEY;
  video_version_id: string;
  title: string;
  duration_ms: number;
  width: number;
  height: number;
  aspect_ratio: '16:9';
  captions_available: true;
  poster_available: true;
  playback_descriptor_path: `/api/app/parent/welcome-video/${string}/playback`;
  activation_threshold_seconds: 10;
  completion_threshold_percent: 90;
};

export type ParentWelcomeVideoSlot = ParentWelcomeVideoUnavailable | ParentWelcomeVideoReady;

export type ParentWelcomePlaybackDescriptor = {
  contract_version: typeof PARENT_WELCOME_VIDEO_CONTRACT_VERSION;
  kind: 'protected_parent_video';
  video_version_id: string;
  media_path: `/api/app/parent/welcome-video/${string}/media`;
  poster_path: `/api/app/parent/welcome-video/${string}/poster`;
  captions_path: `/api/app/parent/welcome-video/${string}/captions`;
  captions_default: true;
  autoplay_policy: 'muted_when_allowed';
  expires_at: string;
};

export type ParentWelcomeVideoSlotRecord = {
  account_key: string;
  product_key: 'one_time_mishnayos';
  runtime_tier: 'isolated_staging' | 'production';
  verification_environment_id: string;
  slot_key: typeof PARENT_WELCOME_VIDEO_SLOT_KEY;
  video_version_id: string;
  content_id: string;
  content_version_id: string;
  publication_generation: number;
  approval_projection_digest: string;
  title: string;
  duration_ms: number;
  width: number;
  height: number;
  captions_available: boolean;
  poster_available: boolean;
};

export type ParentWelcomeEventCommand = {
  event_type: ParentWelcomeBrowserEventType;
  video_version_id: string | null;
  observed_playback_seconds?: number;
  observed_position_percent?: number;
};

export type ParentWelcomeEventBinding = {
  idempotency_key: string;
  canonical_request_hash: string;
  occurred_at: string;
};

export type ParentWelcomeEventRecord = {
  principal: ParentWelcomePrincipal;
  event_type: ParentWelcomeStoredEventType;
  video_version_id: string;
  observed_playback_seconds: number | null;
  observed_position_percent: number | null;
  binding: ParentWelcomeEventBinding;
};

export type ParentWelcomeEventReceipt = {
  event_type: ParentWelcomeStoredEventType;
  video_version_id: string;
  recorded: boolean;
  recorded_at: string;
};

export type ParentWelcomeEventResult = {
  receipts: readonly ParentWelcomeEventReceipt[];
};

export type ParentWelcomeFunnelStep = {
  step_order: number;
  event_type: ParentWelcomeFunnelEventType;
  label: string;
  household_count: number;
  previous_household_count: number | null;
  adjacent_conversion_percent: number | null;
};

export interface ParentWelcomeRepository {
  loadCurrentSlot(principal: ParentWelcomePrincipal): Promise<ParentWelcomeVideoSlotRecord | null>;
  recordEvents(events: readonly ParentWelcomeEventRecord[]): Promise<ParentWelcomeEventReceipt[]>;
  loadFunnelReport(): Promise<readonly ParentWelcomeFunnelStep[]>;
}

export const PARENT_WELCOME_ERROR_CODES = {
  roleDenied: 'parent_welcome_role_denied',
  slotUnavailable: 'parent_welcome_slot_unavailable',
  versionMismatch: 'parent_welcome_version_mismatch',
  invalidEvent: 'parent_welcome_invalid_event',
} as const;

export type ParentWelcomeErrorCode =
  (typeof PARENT_WELCOME_ERROR_CODES)[keyof typeof PARENT_WELCOME_ERROR_CODES];
