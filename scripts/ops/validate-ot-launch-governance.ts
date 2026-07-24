import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalTextForHash } from './canonical-text.ts';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml') as { load(source: string): unknown };
const repoRoot = process.cwd();
const boardPath = 'ops/goals/OT-LAUNCH-01/BOARD.yaml';
const pointerPath = 'ops/previews/current.json';
const writePointer = process.argv.includes('--write-pointer');
const checks: Array<{ name: string; passed: boolean; detail: string }> = [];

const current = await readYaml<Record<string, unknown>>('ops/goals/CURRENT.yaml');
const spec = await readYaml<Record<string, unknown>>('ops/goals/OT-LAUNCH-01/SPEC.yaml');
const acceptance = await readYaml<Record<string, unknown>>(
  'ops/goals/OT-LAUNCH-01/ACCEPTANCE.yaml',
);
const decisionsPath = 'ops/goals/OT-LAUNCH-01/DECISIONS.yaml';
const decisionsText = await readText(decisionsPath);
const decisions = parseYaml<Record<string, unknown>>(decisionsText, decisionsPath);
const boardText = await readFile(path.join(repoRoot, boardPath), 'utf8');
const board = parseYaml<Record<string, unknown>>(boardText, boardPath);
const adminIncident = JSON.parse(
  await readText(
    'ops/goals/OT-LAUNCH-01/handoffs/fictional-admin-credential-exposure--20260722.json',
  ),
) as Record<string, unknown>;
const ramble = await readText('ops/goals/OT-LAUNCH-01/RAMBLE-PROTOCOL.md');
const goalSkill = await readSkill('.agents/skills/one-time-goal-executor/SKILL.md');
const ghlSkill = await readSkill('.agents/skills/one-time-ghl-ui-job/SKILL.md');
const goalSkillUi = await readYaml<Record<string, unknown>>(
  '.agents/skills/one-time-goal-executor/agents/openai.yaml',
);
const ghlSkillUi = await readYaml<Record<string, unknown>>(
  '.agents/skills/one-time-ghl-ui-job/agents/openai.yaml',
);

const sourceHash = `sha256:${createHash('sha256').update(canonicalTextForHash(boardText)).digest('hex')}`;
const expectedPointer = {
  schema_version: 1,
  goal_id: 'OT-LAUNCH-01',
  generated_from_board: boardPath,
  source_hash: sourceHash,
  generated_at: isoTimestamp(board.updated_at, 'board.updated_at'),
};
if (writePointer) {
  await writeFile(
    path.join(repoRoot, pointerPath),
    `${JSON.stringify(expectedPointer, null, 2)}\n`,
    'utf8',
  );
}
const pointer = JSON.parse(await readText(pointerPath)) as Record<string, unknown>;

record(
  'single current goal',
  current.goal_id === 'OT-LAUNCH-01' &&
    current.goal_path === 'ops/goals/OT-LAUNCH-01' &&
    current.board === boardPath,
  `${String(current.goal_id)} -> ${String(current.board)}`,
);
record(
  'single status source',
  spec.source_of_status === boardPath && acceptance.source_of_status === boardPath,
  'SPEC and ACCEPTANCE derive status from BOARD',
);
const statusDefinitions = objectAt(board, 'status_definitions');
const outcome = objectAt(board, 'outcome');
const parsedBoardStrings = collectStrings(board);
const parsedDecisionStrings = collectStrings(decisions);
const suspiciousTruncatedStrings = parsedBoardStrings.filter(({ value }) =>
  /\bPR$/u.test(value.trim()),
);
const suspiciousTruncatedDecisionStrings = parsedDecisionStrings.filter(({ value }) =>
  /\bPR$/u.test(value.trim()),
);
const unquotedHashCommentHazards = findUnquotedHashCommentHazards(boardText);
const unquotedDecisionHashCommentHazards = findUnquotedHashCommentHazards(decisionsText);
const staleCurrentClaims = [
  'Current deployed product source 415d7e49d7567d3e211fb725c0916ece78da4dd0',
  'The current provider-off descendant 4d484c167ab332a6f82b97c7fc4f758c58bb391b',
  'Final superseding rotation completed at 2026-07-22T18:58:54.309Z',
  'The final Admin-only rotation completed at 2026-07-24T09:54:47.696Z',
  'Final rotation at 2026-07-22T18:58:54.309Z',
  'The final fictional Admin rotation at 2026-07-24T09:54:47.696Z',
].filter((claim) => boardText.includes(claim));
record(
  'board status vocabulary',
  sameSet(Object.keys(statusDefinitions), [
    'unclaimed',
    'active',
    'waiting_external',
    'ready_for_convergence',
    'done',
    'blocked',
    'provider_off',
    'needs_operator_decision',
    'superseded',
  ]),
  Object.keys(statusDefinitions).join(', '),
);
const tracks = arrayAt<Record<string, unknown>>(board, 'tracks');
const trackIds = tracks.map((track) => String(track.id));
const trackById = (id: string) => tracks.find((track) => track.id === id);
const conductor = objectAt(board, 'conductor');
const conductorHead = objectAt(conductor, 'head');
record('unique tracks', new Set(trackIds).size === trackIds.length, `${trackIds.length} tracks`);
const criteria = arrayAt<Record<string, unknown>>(acceptance, 'criteria');
const criterionIds = criteria.map((criterion) => String(criterion.id));
const milestones = arrayAt<Record<string, unknown>>(board, 'milestones');
const currentMilestones = milestones.filter((milestone) => milestone.current === true);
const currentMilestone = currentMilestones[0];
const currentMilestoneAcceptance = currentMilestone
  ? arrayAt<string>(currentMilestone, 'acceptance_ids')
  : [];
const currentMilestoneTracks = currentMilestone
  ? arrayAt<string>(currentMilestone, 'track_ids')
  : [];
const currentMilestoneLinks = currentMilestone
  ? arrayAt<Record<string, unknown>>(currentMilestone, 'safe_links')
  : [];
record(
  'current milestone acceptance contract',
  currentMilestones.length === 1 &&
    currentMilestoneAcceptance.length > 0 &&
    new Set(currentMilestoneAcceptance).size === currentMilestoneAcceptance.length &&
    currentMilestoneAcceptance.every((id) => criterionIds.includes(id)) &&
    currentMilestoneAcceptance.every((id) =>
      tracks.some((track) => arrayAt<string>(track, 'acceptance_ids').includes(id)),
    ) &&
    currentMilestoneTracks.length > 0 &&
    new Set(currentMilestoneTracks).size === currentMilestoneTracks.length &&
    currentMilestoneTracks.every((id) => trackIds.includes(id)) &&
    currentMilestoneLinks.length > 0 &&
    currentMilestoneLinks.every((link) => String(link.href).startsWith('/app/')),
  `${String(currentMilestone?.id)}: ${currentMilestoneAcceptance.length} acceptance IDs, ${currentMilestoneTracks.length} tracks`,
);
const criticalParsedSubstrings = [
  'PR #97 exact product head 7dcb137c4d1e3b908dce8230e3089ec58bf57261 adds a fail-closed opener-detachment guard',
  'PR #104 prefix 2214',
  'PR #105 exact successor head e81de91a7372114c6b0a67a7cbb0abc9cb548885',
  'PR #105 exact successor 96e54d9688ff174ac8265ce3b3a6216abb6292dc',
  'PR #105 cleanup-only successor 2d22f46a40364c670d20fa197e78ead2a2f79c8e',
  'PR #106 exact production head acddcc8cd012c5cdc5bfc08cbc80550bef8719ba',
  'Terminal PR #107 head 1e247c70004dffb6247fc1ee407f1153d753bd7d',
  'PR #108 head 4540861a7f7ad950041e4ae58202537055fe59ad',
  'PR #109 head 1779254768dacebb84aeac5d71b56b5abfba2534',
  'PR #110 exact head 38358961cff6c6bf44621ab9e3f6b88061586618',
  'Accepted PR #113 head 45b213a5ddfde97d60f220ae3eb0bdff5cda51ed',
  'Terminal PR #115 head 06c14e9b59c5e7c963397fb961634fe711b00e0c',
  'Final PR #118 head 5741d5d9422c9f326112c636880de365ca3cc35a',
  'Final PR #119 head 17ee48e1f2f0abaea0b319ad69a5e384048cdd52',
  'Final PR #120 head e5e52114828401d575ca2baae35db364e608d91a',
  'PR #141 exact head adf0189ddbb3f279683d58ec44edb5ca0e9f1fbe',
];
record(
  'critical PR scalars parse intact',
  String(outcome.production_impact).includes('PR #106') &&
    criticalParsedSubstrings.every((expected) =>
      parsedBoardStrings.some(({ value }) => value.includes(expected)),
    ),
  `${criticalParsedSubstrings.length} critical parsed substrings preserved`,
);
record(
  'parsed strings have no hash-comment truncation',
  suspiciousTruncatedStrings.length === 0,
  `${parsedBoardStrings.length} strings scanned; suspicious=${
    suspiciousTruncatedStrings
      .map(({ path: valuePath, value }) => `${valuePath}=${JSON.stringify(value)}`)
      .join(', ') || 'none'
  }`,
);
record(
  'board has no unquoted hash-comment hazards',
  unquotedHashCommentHazards.length === 0,
  unquotedHashCommentHazards.join(', ') || 'none',
);
record(
  'decisions have no hash-comment truncation or unquoted hazards',
  suspiciousTruncatedDecisionStrings.length === 0 &&
    unquotedDecisionHashCommentHazards.length === 0,
  `parsed=${parsedDecisionStrings.length}; suspicious=${
    suspiciousTruncatedDecisionStrings
      .map(({ path: valuePath, value }) => `${valuePath}=${JSON.stringify(value)}`)
      .join(', ') || 'none'
  }; hazards=${unquotedDecisionHashCommentHazards.join(', ') || 'none'}`,
);
record(
  'board has no superseded current or final claims',
  staleCurrentClaims.length === 0,
  staleCurrentClaims.join(', ') || 'none',
);
record(
  'structured track owners',
  tracks.every((track) => {
    const owner = objectAt(track, 'owner');
    return ['task_id', 'repository', 'branch', 'pr', 'system'].every((field) => field in owner);
  }),
  'task_id/repository/branch/pr/system present for every track',
);
record(
  'current persistent-staging product evidence',
  conductorHead.last_verified_commit === 'a22009f4dce6bae6b0553ea9007ff40eceaffd25' &&
    (() => {
      const track = trackById('persistent_staging');
      if (!track) return false;
      const owner = objectAt(track, 'owner');
      const evidence = arrayAt<string>(track, 'evidence');
      return (
        track.status === 'done' &&
        owner.head === 'a22009f4dce6bae6b0553ea9007ff40eceaffd25' &&
        evidence.some(
          (value) =>
            value.includes('staging web deployment 8ac8aae7-fb2e-4b19-9e3e-b8bf27db4004') &&
            value.includes('worker deployment 4ee9afc9-8727-4f0c-9074-2fe4bafd41a9') &&
            value.includes('2227_event_service_email_permission_convergence'),
        )
      );
    })() &&
    String(outcome.current_summary).includes(
      'web deployment 8ac8aae7-fb2e-4b19-9e3e-b8bf27db4004',
    ) &&
    String(outcome.current_summary).includes(
      'worker deployment 4ee9afc9-8727-4f0c-9074-2fe4bafd41a9',
    ) &&
    String(outcome.current_summary).includes('2227_event_service_email_permission_convergence') &&
    parsedBoardStrings.some(({ value }) => value.includes('439/439 configured unit tests')) &&
    parsedBoardStrings.some(({ value }) => value.includes('2,121-file secret scan')),
  'a22009f deployed through exact web/worker with schema 2227 and same-snapshot gates',
);
record(
  'event-only permission convergence is integrated and provider-disabled',
  (() => {
    const track = trackById('event_service_email_permission');
    if (!track) return false;
    const owner = objectAt(track, 'owner');
    const evidence = arrayAt<string>(track, 'evidence');
    return (
      track.status === 'done' &&
      owner.pr === 122 &&
      owner.head === '37b83461bb1fed8c0f795234e125b5270d5414c0' &&
      track.handoff_path ===
        'ops/goals/OT-LAUNCH-01/handoffs/event-service-email-permission--OT-LAUNCH-01-EVENT-PERMISSION-CONVERGENCE.json' &&
      track.blocker === null &&
      track.remaining_work === null &&
      evidence.some(
        (value) =>
          value.includes('2227_event_service_email_permission_convergence.sql') &&
          value.includes('746ea6efdd06ce5ff20ffbfbf7bb9bab759dea5e3976fbb3442140b8a0e29f86'),
      ) &&
      evidence.some(
        (value) =>
          value.includes('HIGHLEVEL_EVENT_SYNC_MODE=disabled') &&
          value.includes('HIGHLEVEL_ACTIONS_MODE=disabled') &&
          value.includes('HIGHLEVEL_CANARY_BUDGET=0'),
      ) &&
      evidence.some(
        (value) =>
          value.includes('No GHL mutation') && value.includes('production mutation occurred'),
      )
    );
  })(),
  'PR #122 source convergence is done at schema 2227 while every live HighLevel gate stays off',
);
record(
  'current role-preview and fictional-session evidence',
  (() => {
    const previewTrack = trackById('admin_experience_preview');
    const sessionTrack = trackById('fictional_student_session');
    if (!previewTrack || !sessionTrack) return false;
    return (
      previewTrack.status === 'done' &&
      sessionTrack.status === 'done' &&
      objectAt(previewTrack, 'owner').head === 'f40acecb6fc3227d71f04065c8703ba2d134ede5' &&
      objectAt(sessionTrack, 'owner').head === 'f40acecb6fc3227d71f04065c8703ba2d134ede5' &&
      parsedBoardStrings.some(
        ({ value }) =>
          value.includes('Today, Library, Class Helper, Progress, Questions, and Updates') &&
          value.includes('opener absent') &&
          value.includes('original Administrator tab remained authenticated'),
      )
    );
  })(),
  'Admin launcher, navigable read-only Student session, sibling scope, and preserved Admin session',
);
record(
  'production pilot remains dependency-gated',
  (() => {
    const track = trackById('production_pilot');
    if (!track) return false;
    const dependencies = arrayAt<string>(track, 'dependencies');
    return (
      track.status === 'unclaimed' &&
      dependencies.includes('zoom_meeting_sdk') &&
      dependencies.includes('zoom_s2s_host_control') &&
      dependencies.includes('zoom_real_control_operator_change_set')
    );
  })(),
  'production_pilot cannot be projected executable before all three Zoom tracks are done',
);
record(
  'Zoom disposable lifecycle remains fail-closed',
  (() => {
    const sdkTrack = trackById('zoom_meeting_sdk');
    const hostTrack = trackById('zoom_s2s_host_control');
    const operatorTrack = trackById('zoom_real_control_operator_change_set');
    if (!sdkTrack || !hostTrack || !operatorTrack) return false;
    const operatorBlocker = objectAt(operatorTrack, 'blocker');
    const externalActions = arrayAt<Record<string, unknown>>(outcome, 'external_actions');
    return (
      sdkTrack.status === 'provider_off' &&
      hostTrack.status === 'provider_off' &&
      operatorTrack.status === 'blocked' &&
      objectAt(sdkTrack, 'owner').head === '2d22f46a40364c670d20fa197e78ead2a2f79c8e' &&
      objectAt(hostTrack, 'owner').head === '2d22f46a40364c670d20fa197e78ead2a2f79c8e' &&
      objectAt(operatorTrack, 'owner').head === '2d22f46a40364c670d20fa197e78ead2a2f79c8e' &&
      operatorBlocker.code === 'RAILWAY_PROVIDER_SESSION_NOT_AUTHENTICATED_AFTER_HOST_RESTART' &&
      externalActions.some(
        (action) =>
          action.kind === 'zoom_disposable_isolated_canary_lifecycle' &&
          action.count === 1 &&
          String(action.scope).includes('cleanup_required'),
      ) &&
      parsedBoardStrings.some(({ value }) =>
        value.includes('ce9ca160-d72b-496c-a2c9-b3b8efa9c975'),
      ) &&
      parsedBoardStrings.some(({ value }) =>
        value.includes('d4f10489-1d8a-4518-8db2-a6da309dda8f'),
      ) &&
      parsedBoardStrings.some(({ value }) =>
        value.includes('c6d90077-de1c-41ed-b30e-cda5389b98b2'),
      ) &&
      parsedBoardStrings.some(({ value }) =>
        value.includes('2c0d6ed8-a7e1-4da2-baf9-06323de78dc8'),
      ) &&
      parsedBoardStrings.some(({ value }) => value.includes('019f9460-bdcc-7f63-9273-0a05e75fcf19'))
    );
  })(),
  'one disposable meeting exists; provider cleanup awaits restored Railway browser authentication',
);
record(
  'external action accounting is exact',
  (() => {
    const externalActions = arrayAt<Record<string, unknown>>(outcome, 'external_actions');
    const counted = externalActions.reduce(
      (sum, action) => sum + (typeof action.count === 'number' ? action.count : 0),
      0,
    );
    const loginAction = externalActions.find(
      (action) => action.kind === 'fictional_staging_admin_login_code_challenge',
    );
    const mediaAction = externalActions.find(
      (action) => action.kind === 'media_private_external_canary_lifecycle',
    );
    return (
      outcome.external_action_count === counted &&
      outcome.external_action_count === 18 &&
      loginAction?.count === 12 &&
      mediaAction?.count === 1 &&
      String(mediaAction.scope).includes('one OpenAI transcription') &&
      String(mediaAction.scope).includes('one private Vimeo asset') &&
      String(mediaAction.scope).includes('no provider/media-processing retry')
    );
  })(),
  'external_action_count=18 equals row sum and includes 12 bounded staging login-code emails plus one bounded private-media lifecycle',
);
record(
  'fictional Admin incident is rotated and auditable',
  adminIncident.schema_version === 3 &&
    objectAt(adminIncident, 'rotation').status === 'complete' &&
    objectAt(adminIncident, 'rotation').rotated_at === '2026-07-24T13:14:22.759Z' &&
    objectAt(adminIncident, 'rotation').active_sessions_before === 0 &&
    objectAt(adminIncident, 'rotation').active_sessions_after === 0 &&
    objectAt(adminIncident, 'rotation').protected_handoff_replaced_atomically === true &&
    objectAt(adminIncident, 'rotation').old_credential_rejected === true &&
    objectAt(adminIncident, 'rotation').credential_printed === false &&
    objectAt(adminIncident, 'rotation_execution').source_head ===
      '4cf4d491a6190fcad278d9cfd2324728d28c3cc4' &&
    parsedBoardStrings.some(({ value }) => value.includes('14,140 Codex text/log files')),
  'Admin-only rotation complete; old value remains explicitly classified as compromised',
);
record(
  'Admin IA is accepted and integrated',
  (() => {
    const track = trackById('admin_information_architecture');
    if (!track) return false;
    const owner = objectAt(track, 'owner');
    return (
      track.status === 'done' &&
      owner.pr === 118 &&
      owner.head === '5741d5d9422c9f326112c636880de365ca3cc35a' &&
      parsedBoardStrings.some(({ value }) =>
        value.includes('restores server-capability-gated Live Console visibility'),
      ) &&
      parsedBoardStrings.some(({ value }) =>
        value.includes('Dashboard Preview Parent & Student portals CTA'),
      )
    );
  })(),
  'PR #118 final head is integrated with capability gating and Dashboard discovery restored',
);
record(
  'Rabbi Telegram is accepted and integrated',
  (() => {
    const track = trackById('rabbi_telegram_communications');
    if (!track) return false;
    const owner = objectAt(track, 'owner');
    return (
      track.status === 'done' &&
      owner.pr === 119 &&
      owner.head === '17ee48e1f2f0abaea0b319ad69a5e384048cdd52' &&
      parsedBoardStrings.some(({ value }) => value.includes('exact row-count fence')) &&
      parsedBoardStrings.some(({ value }) =>
        value.includes('stale terminal failure cannot overwrite'),
      )
    );
  })(),
  'PR #119 final head is integrated with stale-generation failure fencing',
);
record(
  'Parent and Student contact operations are accepted and integrated',
  (() => {
    const track = trackById('parent_student_contact_operations');
    if (!track) return false;
    const owner = objectAt(track, 'owner');
    return (
      track.status === 'done' &&
      owner.pr === 120 &&
      owner.head === 'e5e52114828401d575ca2baae35db364e608d91a' &&
      track.handoff_path ===
        'ops/goals/OT-LAUNCH-01/handoffs/parent-student-contact-operations--OT-LAUNCH-01-CONTACT-OPS-01.json' &&
      parsedBoardStrings.some(({ value }) =>
        value.includes('2225_parent_student_contact_operations'),
      ) &&
      parsedBoardStrings.some(({ value }) =>
        value.includes('9139d459e2211ca988e96939ce149562f083f62d'),
      )
    );
  })(),
  'PR #120 final head is integrated with exact 2225 migration evidence',
);
record(
  'accepted occurrence-scoped video track',
  tracks.some((track) => {
    const owner = objectAt(track, 'owner');
    return (
      track.id === 'VIDEO-TO-CLASSROOM-E2E' &&
      track.status === 'done' &&
      owner.repository === 'shloimie-beep/onetimev2' &&
      owner.branch === 'codex/video-to-classroom-e2e' &&
      owner.pr === 113 &&
      owner.head === '45b213a5ddfde97d60f220ae3eb0bdff5cda51ed' &&
      track.handoff_path ===
        'ops/goals/OT-LAUNCH-01/handoffs/video-to-classroom-e2e--pr-113.json' &&
      arrayAt<string>(track, 'acceptance_ids').includes('VIDEO-E2E-001')
    );
  }) &&
    parsedBoardStrings.some(({ value }) =>
      value.includes('5556c4ab78e01d367666694459eb2ea97f4028ef'),
    ) &&
    parsedBoardStrings.some(({ value }) =>
      value.includes(
        '2224_content_factory_publish_ready_constraint.sql; SQL bytes and checksum 59ac22d69f56382669d70d1e78c7556e162efcc3183a5552b111f3d7b9953a65 are unchanged',
      ),
    ),
  'PR #113 accepted at 45b213a and deployed in product source 5556c4a with exact 2224 checksum',
);
record(
  'terminal private-media canary is complete and non-repeatable',
  (() => {
    const track = trackById('media_external_canary');
    const decisionRows = arrayAt<Record<string, unknown>>(decisions, 'decisions');
    const canaryDecision = decisionRows.find(
      (decision) => decision.id === 'provider-canaries-reaffirmed-20260723',
    );
    if (!track || !canaryDecision) return false;
    const owner = objectAt(track, 'owner');
    const evidence = arrayAt<string>(track, 'evidence');
    return (
      track.status === 'done' &&
      owner.pr === 117 &&
      owner.head === '13656a558b44d6af533720697e4e9eb12d22bf9e' &&
      track.blocker === null &&
      track.remaining_work === null &&
      evidence.some(
        (value) =>
          value.includes('one OpenAI whisper-1 transcription') &&
          value.includes('one private Vimeo asset') &&
          value.includes('provider/media-processing retries were zero'),
      ) &&
      evidence.some((value) => value.includes('Final unpublish left zero active canary')) &&
      String(canaryDecision.decision).includes('The media portion was consumed exactly once') &&
      String(canaryDecision.decision).includes('grants no retry')
    );
  })(),
  'PR #117 is terminal, final publication is revoked, and the consumed authority cannot be replayed',
);
record(
  'accepted Tisha production plus isolated preview block',
  tracks.some((track) => {
    const owner = objectAt(track, 'owner');
    return (
      track.id === 'tisha_landing_polish' &&
      track.status === 'blocked' &&
      owner.pr === 110 &&
      owner.head === '38358961cff6c6bf44621ab9e3f6b88061586618' &&
      track.preview_review_state === 'PREVIEW_VERIFIED_PRODUCTION_BLOCKED' &&
      parsedBoardStrings.some(({ value }) =>
        value.includes('acddcc8cd012c5cdc5bfc08cbc80550bef8719ba'),
      ) &&
      parsedBoardStrings.some(({ value }) =>
        value.includes('81317abe-f3ef-42cd-b5db-5814b014b6a3'),
      ) &&
      parsedBoardStrings.some(({ value }) =>
        value.includes('PR #110 is not integrated into PR #97'),
      )
    );
  }),
  'PR #106 acddcc8 remains accepted production while PR #110 3835896 is isolated',
);
record(
  'Zoom SDK preview and real control remain distinct',
  tracks.some((track) => {
    const owner = objectAt(track, 'owner');
    return (
      track.id === 'zoom_meeting_sdk' &&
      track.status === 'provider_off' &&
      owner.task_id === 'OT-LAUNCH-01-ZOOM-STAGING-CANARY-PREP' &&
      owner.repository === 'shloimie-beep/onetimev2' &&
      owner.branch === 'codex/zoom-real-control-activation' &&
      owner.pr === 105 &&
      owner.head === '2d22f46a40364c670d20fa197e78ead2a2f79c8e' &&
      track.zoom_ui_preview_state === 'READY' &&
      track.zoom_real_control_state === 'PROVIDER_OFF'
    );
  }) &&
    tracks.some((track) => {
      const owner = objectAt(track, 'owner');
      return (
        track.id === 'zoom_s2s_host_control' &&
        track.status === 'provider_off' &&
        owner.task_id === 'OT-LAUNCH-01-ZOOM-STAGING-CANARY-PREP' &&
        owner.repository === 'shloimie-beep/onetimev2' &&
        owner.branch === 'codex/zoom-real-control-activation' &&
        owner.pr === 105 &&
        owner.head === '2d22f46a40364c670d20fa197e78ead2a2f79c8e' &&
        track.zoom_ui_preview_state === 'READY' &&
        track.zoom_real_control_state === 'PROVIDER_OFF'
      );
    }) &&
    parsedBoardStrings.some(({ value }) =>
      value.includes(
        'ZOOM_MEETING_SDK_CLIENT_ID, ZOOM_MEETING_SDK_CLIENT_SECRET, and ZOOM_MEETING_SDK_WEB_VERSION',
      ),
    ) &&
    parsedBoardStrings.some(({ value }) =>
      value.includes(
        'canonical ZOOM_S2S_ACCOUNT_ID (with temporary ZOOM_ACCOUNT_ID alias also absent), ZOOM_S2S_CLIENT_ID, ZOOM_S2S_CLIENT_SECRET, ZOOM_HOST_USER_ID, ZOOM_REAL_CONTROL_MEETING_ID, and ZOOM_REAL_CONTROL_MEETING_PASSCODE',
      ),
    ),
  'isolated SDK setup READY; normal-Student code deployed; real control PROVIDER_OFF',
);
record(
  'honest GHL enrollment truth',
  parsedBoardStrings.some(({ value }) =>
    value.includes('OT-07 and OT-08 each read back 0 total / 0 active'),
  ) &&
    parsedBoardStrings.some(({ value }) =>
      value.includes('GHL-GOVERNANCE-CLOSEOUT-20260722.result.json'),
    ),
  'zero counts require the committed timestamped closeout readback',
);
record(
  'current GHL drift and protective pause remain fail-closed',
  (() => {
    const e01Track = trackById('ghl_ot_e01');
    const c01Track = trackById('ghl_ot_c01_tisha_invitation');
    const shellTrack = trackById('ghl_app_contract_shells');
    if (!e01Track || !c01Track || !shellTrack) return false;
    return (
      e01Track.status === 'blocked' &&
      objectAt(e01Track, 'blocker').code ===
        'DRIFTED_EMAIL_A_DISABLED_ACTION_IDENTITY_UNVERIFIED' &&
      c01Track.status === 'blocked' &&
      shellTrack.status === 'blocked' &&
      parsedBoardStrings.some(({ value }) => value.includes('2,677 historical total / 0 active')) &&
      parsedBoardStrings.some(({ value }) =>
        value.includes('remain unique exact-ID DRAFT_SHELL assets'),
      ) &&
      parsedBoardStrings.some(({ value }) =>
        value.includes('The historical passed canary remains historical'),
      )
    );
  })(),
  'OT-E01 DRIFTED, OT-C01 wrapper Draft, campaign untouched, target shells empty',
);
record(
  'goal decisions parsed',
  Array.isArray(decisions.decisions) && decisions.decisions.length > 0,
  `${Array.isArray(decisions.decisions) ? decisions.decisions.length : 0} decisions`,
);
record(
  'ramble visual loop',
  ramble.includes('observable breakpoint checks') &&
    ramble.includes('Inspect the current deployed page') &&
    ramble.includes('verify the exact deployed URL/head'),
  'breakpoint acceptance, inspection, repair, retest, deploy proof',
);
record(
  'goal executor contract',
  goalSkill.frontmatter.name === 'one-time-goal-executor' &&
    goalSkill.body.includes('single editable automation inventory') &&
    goalSkill.body.includes('DRAFT_WAITING_EXTERNAL') &&
    goalSkill.body.includes('full nested folder topology'),
  String(goalSkill.frontmatter.name),
);
record(
  'GHL UI skill contract',
  ghlSkill.frontmatter.name === 'one-time-ghl-ui-job' &&
    ghlSkill.body.includes('single editable automation inventory') &&
    ghlSkill.body.includes('DRAFT_WAITING_EXTERNAL') &&
    ghlSkill.body.includes('essential values') &&
    ghlSkill.body.includes('Email Marketing campaign'),
  String(ghlSkill.frontmatter.name),
);
record(
  'skill UI metadata',
  Boolean(objectAt(goalSkillUi, 'interface').default_prompt) &&
    Boolean(objectAt(ghlSkillUi, 'interface').default_prompt),
  'both agents/openai.yaml files parse with default prompts',
);
record(
  'pointer-only board projection',
  JSON.stringify(pointer) === JSON.stringify(expectedPointer) &&
    Object.keys(pointer).every((key) => Object.hasOwn(expectedPointer, key)),
  sourceHash,
);

const passed = checks.every((check) => check.passed);
process.stdout.write(
  `${JSON.stringify({ status: passed ? 'passed' : 'failed', checks }, null, 2)}\n`,
);
if (!passed) process.exitCode = 1;

function record(name: string, passed: boolean, detail: string) {
  checks.push({ name, passed, detail });
}

async function readText(filePath: string) {
  return readFile(path.join(repoRoot, filePath), 'utf8');
}

async function readYaml<T>(filePath: string) {
  return parseYaml<T>(await readText(filePath), filePath);
}

function parseYaml<T>(source: string, filePath: string) {
  const value = yaml.load(source);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`yaml_root_invalid:${filePath}`);
  }
  return value as T;
}

async function readSkill(filePath: string) {
  const source = await readText(filePath);
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/u.exec(source);
  if (!match) throw new Error(`skill_frontmatter_invalid:${filePath}`);
  return {
    frontmatter: parseYaml<Record<string, unknown>>(match[1] ?? '', filePath),
    body: match[2] ?? '',
  };
}

function isoTimestamp(value: unknown, field: string) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString();
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`governance_datetime_missing:${field}`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error(`governance_datetime_invalid:${field}`);
  }
  return parsed.toISOString();
}

function objectAt(value: Record<string, unknown>, key: string) {
  const candidate = value[key];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error(`object_missing:${key}`);
  }
  return candidate as Record<string, unknown>;
}

function arrayAt<T>(value: Record<string, unknown>, key: string) {
  const candidate = value[key];
  if (!Array.isArray(candidate)) throw new Error(`array_missing:${key}`);
  return candidate as T[];
}

function sameSet(left: string[], right: string[]) {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function collectStrings(value: unknown, valuePath = '$'): Array<{ path: string; value: string }> {
  if (typeof value === 'string') return [{ path: valuePath, value }];
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectStrings(entry, `${valuePath}[${index}]`));
  }
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, entry]) =>
    collectStrings(entry, `${valuePath}.${key}`),
  );
}

function findUnquotedHashCommentHazards(source: string) {
  const hazards: string[] = [];
  for (const [lineIndex, line] of source.split(/\r?\n/u).entries()) {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === "'" && !inDoubleQuote) {
        if (inSingleQuote && line[index + 1] === "'") {
          index += 1;
        } else {
          inSingleQuote = !inSingleQuote;
        }
        continue;
      }
      if (character === '"' && !inSingleQuote && line[index - 1] !== '\\') {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }
      if (
        character === '#' &&
        !inSingleQuote &&
        !inDoubleQuote &&
        (index === 0 || /\s/u.test(line[index - 1] ?? ''))
      ) {
        hazards.push(`line ${lineIndex + 1}`);
        break;
      }
    }
  }
  return hazards;
}
