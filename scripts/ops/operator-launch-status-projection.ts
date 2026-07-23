import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import type { OperatorLaunchStatusProjection } from '../../packages/contracts/src/ops/index.ts';
import { operatorLaunchStatusProjectionSchema } from '../../packages/contracts/src/ops/index.ts';
import { canonicalTextForHash } from './canonical-text.ts';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml') as { load(source: string): unknown };

const BOARD_PATH = 'ops/goals/OT-LAUNCH-01/BOARD.yaml' as const;

type BoardTrack = {
  id?: unknown;
  status?: unknown;
  acceptance_ids?: unknown;
  blocker?: unknown;
  next_action?: unknown;
};

type ParsedBoard = {
  goal_id?: unknown;
  updated_at?: unknown;
  outcome?: unknown;
  tracks?: unknown;
  milestones?: unknown;
};

type ParsedAcceptance = {
  criteria?: unknown;
};

export function buildOperatorLaunchStatusProjection(input: {
  boardText: string;
  acceptanceText: string;
}): OperatorLaunchStatusProjection {
  const board = parseYaml<ParsedBoard>(input.boardText, BOARD_PATH);
  const acceptance = parseYaml<ParsedAcceptance>(
    input.acceptanceText,
    'ops/goals/OT-LAUNCH-01/ACCEPTANCE.yaml',
  );
  if (board.goal_id !== 'OT-LAUNCH-01') throw new Error('launch_status_goal_mismatch');
  const outcome = objectValue(board.outcome, 'outcome');
  const tracks = arrayValue<BoardTrack>(board.tracks, 'tracks');
  const currentMilestones = arrayValue<Record<string, unknown>>(
    board.milestones,
    'milestones',
  ).filter((milestone) => milestone.current === true);
  if (currentMilestones.length !== 1) {
    throw new Error(`launch_status_current_milestone_count:${currentMilestones.length}`);
  }
  const currentMilestone = currentMilestones[0]!;
  const milestoneAcceptanceIds = stringArray(
    currentMilestone.acceptance_ids,
    'milestones.current.acceptance_ids',
  );
  const milestoneTrackIds = stringArray(currentMilestone.track_ids, 'milestones.current.track_ids');
  const safeLinks = arrayValue<Record<string, unknown>>(
    currentMilestone.safe_links,
    'milestones.current.safe_links',
  ).map((link) => ({
    id: stringValue(link.id, 'milestones.current.safe_links.id'),
    label: stringValue(link.label, 'milestones.current.safe_links.label'),
    href: stringValue(link.href, 'milestones.current.safe_links.href'),
  }));
  const knownAcceptanceIds = new Set(
    arrayValue<Record<string, unknown>>(acceptance.criteria, 'criteria').map((criterion) =>
      stringValue(criterion.id, 'criteria.id'),
    ),
  );
  const activeTracks = tracks.filter((track) => track.status !== 'superseded');
  const acceptanceOwners = new Map<string, BoardTrack[]>();
  for (const track of activeTracks) {
    for (const acceptanceId of stringArray(track.acceptance_ids, `${track.id}.acceptance_ids`)) {
      if (!knownAcceptanceIds.has(acceptanceId)) {
        throw new Error(`launch_status_unknown_acceptance:${acceptanceId}`);
      }
      const owners = acceptanceOwners.get(acceptanceId) ?? [];
      owners.push(track);
      acceptanceOwners.set(acceptanceId, owners);
    }
  }
  if (acceptanceOwners.size === 0) throw new Error('launch_status_acceptance_empty');

  if (new Set(milestoneAcceptanceIds).size !== milestoneAcceptanceIds.length) {
    throw new Error('launch_status_milestone_acceptance_duplicate');
  }
  if (new Set(milestoneTrackIds).size !== milestoneTrackIds.length) {
    throw new Error('launch_status_milestone_track_duplicate');
  }
  const trackById = new Map(
    activeTracks.map((track) => [stringValue(track.id, 'track.id'), track] as const),
  );
  const milestoneTracks = milestoneTrackIds.map((trackId) => {
    const track = trackById.get(trackId);
    if (!track) throw new Error(`launch_status_milestone_track_missing:${trackId}`);
    return track;
  });
  const milestoneAcceptanceOwners = milestoneAcceptanceIds.map((acceptanceId) => {
    if (!knownAcceptanceIds.has(acceptanceId)) {
      throw new Error(`launch_status_milestone_acceptance_unknown:${acceptanceId}`);
    }
    const owners = (acceptanceOwners.get(acceptanceId) ?? []).filter((track) =>
      milestoneTrackIds.includes(stringValue(track.id, 'track.id')),
    );
    if (owners.length === 0) {
      throw new Error(`launch_status_milestone_acceptance_unassigned:${acceptanceId}`);
    }
    return owners;
  });
  const acceptanceComplete = milestoneAcceptanceOwners.filter((owners) =>
    owners.every((track) => track.status === 'done'),
  ).length;
  const acceptanceTotal = milestoneAcceptanceIds.length;
  const worksNow = milestoneTracks
    .filter((track) => track.status === 'done')
    .map((track) => ({
      track_id: stringValue(track.id, 'track.id'),
      label: trackLabel(stringValue(track.id, 'track.id')),
      status: 'done' as const,
      acceptance_ids: stringArray(track.acceptance_ids, `${track.id}.acceptance_ids`).filter(
        (acceptanceId) => milestoneAcceptanceIds.includes(acceptanceId),
      ),
    }))
    .filter((track) => track.acceptance_ids.length > 0);
  const remaining = milestoneTracks
    .filter((track) => track.status !== 'done')
    .map((track) => ({
      track_id: stringValue(track.id, 'track.id'),
      label: trackLabel(stringValue(track.id, 'track.id')),
      status: launchState(track.status),
      next_action: stringValue(track.next_action, `${track.id}.next_action`),
    }));
  const blockers = milestoneTracks.flatMap((track) => {
    if (!track.blocker) return [];
    const blocker = objectValue(track.blocker, `${track.id}.blocker`);
    return [
      {
        track_id: stringValue(track.id, 'track.id'),
        label: trackLabel(stringValue(track.id, 'track.id')),
        status: launchState(track.status),
        code: stringValue(blocker.code, `${track.id}.blocker.code`),
        reason: stringValue(blocker.reason, `${track.id}.blocker.reason`),
      },
    ];
  });
  const nextTrack = milestoneTracks.find(
    (track) =>
      (track.status === 'active' ||
        track.status === 'unclaimed' ||
        track.status === 'ready_for_convergence') &&
      !track.blocker &&
      typeof track.next_action === 'string' &&
      track.next_action.trim().length > 0,
  );
  if (!nextTrack) throw new Error('launch_status_next_task_missing');

  const projection = operatorLaunchStatusProjectionSchema.parse({
    schema_version: 'ot.operator-launch-status.v1',
    goal_id: 'OT-LAUNCH-01',
    generated_from_board: BOARD_PATH,
    board_source_hash: `sha256:${createHash('sha256')
      .update(canonicalTextForHash(input.boardText))
      .digest('hex')}`,
    generated_at: isoString(board.updated_at, 'updated_at'),
    current_milestone: {
      label: stringValue(currentMilestone.label, 'milestones.current.label'),
      acceptance_complete: acceptanceComplete,
      acceptance_total: acceptanceTotal,
      percentage: Math.round((acceptanceComplete / acceptanceTotal) * 100),
    },
    what_changed: stringValue(outcome.current_summary, 'outcome.current_summary'),
    works_now: worksNow,
    remaining,
    blockers,
    safe_links: safeLinks,
    next_executable_task: {
      track_id: stringValue(nextTrack.id, 'track.id'),
      label: trackLabel(stringValue(nextTrack.id, 'track.id')),
      action: stringValue(nextTrack.next_action, `${nextTrack.id}.next_action`),
    },
  });
  assertProjectionPrivacy(projection);
  return projection;
}

export function renderOperatorLaunchStatusModule(projection: OperatorLaunchStatusProjection) {
  return [
    '// Generated by scripts/ops/generate-operator-launch-status.ts. Do not edit.',
    "import type { OperatorLaunchStatusProjection } from '../../../../../packages/contracts/src/ops/index.ts';",
    '',
    `export const operatorLaunchStatusProjection = ${JSON.stringify(projection, null, 2)} as const satisfies OperatorLaunchStatusProjection;`,
    '',
  ].join('\n');
}

function parseYaml<T>(source: string, filePath: string) {
  const value = yaml.load(source);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`yaml_root_invalid:${filePath}`);
  }
  return value as T;
}

function objectValue(value: unknown, field: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`launch_status_object_missing:${field}`);
  }
  return value as Record<string, unknown>;
}

function arrayValue<T>(value: unknown, field: string) {
  if (!Array.isArray(value)) throw new Error(`launch_status_array_missing:${field}`);
  return value as T[];
}

function stringArray(value: unknown, field: string) {
  return arrayValue<unknown>(value, field).map((entry) => stringValue(entry, field));
}

function stringValue(value: unknown, field: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`launch_status_string_missing:${field}`);
  }
  return value.trim();
}

function isoString(value: unknown, field: string) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString();
  const parsed = new Date(stringValue(value, field));
  if (Number.isNaN(parsed.valueOf())) throw new Error(`launch_status_datetime_invalid:${field}`);
  return parsed.toISOString();
}

function launchState(value: unknown) {
  if (
    value === 'unclaimed' ||
    value === 'active' ||
    value === 'waiting_external' ||
    value === 'ready_for_convergence' ||
    value === 'done' ||
    value === 'blocked' ||
    value === 'provider_off' ||
    value === 'needs_operator_decision'
  ) {
    return value;
  }
  throw new Error(`launch_status_state_invalid:${String(value)}`);
}

function trackLabel(trackId: string) {
  const labels: Record<string, string> = {
    bna_foundation: 'BNA Agent Action foundation',
    bna_durability: 'BNA durable queue',
    ghl_app_contract_shells: 'GHL workflow contracts',
    ghl_event_dispatcher: 'GHL application dispatcher',
    ghl_organization: 'GHL organization',
    ghl_ot_c01_tisha_invitation: "GHL Tisha B'Av invitation",
    ghl_ot_e01: "GHL Tisha B'Av registration",
    zoom_meeting_sdk: 'Zoom Meeting SDK',
    zoom_s2s_host_control: 'Zoom host controls',
  };
  if (labels[trackId]) return labels[trackId];
  return trackId
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/gu, (character) => character.toUpperCase());
}

function assertProjectionPrivacy(projection: OperatorLaunchStatusProjection) {
  const text = JSON.stringify({
    what_changed: projection.what_changed,
    works_now: projection.works_now,
    remaining: projection.remaining,
    blockers: projection.blockers,
    next_executable_task: projection.next_executable_task,
  });
  if (/https?:\/\//iu.test(text)) throw new Error('launch_status_external_url_forbidden');
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu.test(text)) {
    throw new Error('launch_status_private_destination_forbidden');
  }
  for (const link of projection.safe_links) {
    if (!link.href.startsWith('/app/')) throw new Error('launch_status_unsafe_link');
  }
}
