# One Time — Parallel Launch Window Map

**Date:** 2026-08-13  
**Integration authority:** PR #131  
**Control/marketing decisions:** PR #183  
**Status:** Current coordination map; no provider or production action authorized by this file

## Current active truth

- PR #131 is the sole product integration and deployment path.
- PR #189 already owns the current Zoom Student-live-state delta. Do not open a competing Zoom implementation branch.
- PR #171 is the current local media-runner/Vimeo successor candidate, but it predates the latest PR #131 head and requires current-head reconciliation before integration.
- PR #145 contains the bounded GHL OT-01 and Rabbi sender/reply proof. It does not complete the state-driven Family sequence.
- The Rabbi Telegram communications worker from merged PR #119 exists in the current codebase, but production provider activation and the support-agent bridge are not yet accepted.
- PR #183 owns current operator overrides, marketing strategy, media organization, attribution, pipeline/email design, and this coordination map.

## Lane 0 — Existing PR #131 controller

**Purpose:** integration, deployment order, cross-lane conflict resolution, final canaries, rollback, and launch acceptance.

**Owns:** shared config, canonical source-of-truth reconciliation, migrations, integration, Railway/provider gates, production deployment.

**Must not:** redo mechanical marketing-media work.

## Lane 1 — Zoom continuation

**Existing work:** PR #189.

**Purpose:** complete the existing host-connected → Student `Class is live` behavior, merge only after exact-head verification, then return to the PR #131 controller for protected production acceptance.

**Write scope:** existing PR #189 files only; no GHL, Vimeo/content, Telegram, marketing, or consent work.

## Lane 2 — Vimeo/content and local runner

**Existing work:** PR #171 plus current PR #131 content implementation.

**Purpose:** reconcile the local Windows runner to current PR #131, complete local intake → FFmpeg → optional transcription → private Vimeo → Admin review → protected Student playback → safe unpublish.

**Write scope:** local media runner, content local-control routes, content runbooks/tests, and required current-head handoff. No Zoom, GHL, Telegram, marketing, or broad UI work.

## Lane 3 — GHL pipeline, attribution, and Family emails

**Existing proof:** PR #145.

**Purpose:** read back live pipeline/workflows; reconcile source-of-truth; configure the adult-only Family lifecycle pipeline and state-driven email workflows as Draft; preserve Rabbi sender/reply; run one bounded operator seed only after approval.

**Write scope:** HighLevel registry/prompts/results and authorized GHL Draft configuration. No app code, Student contacts, broad send, billing activation, or publication.

## Lane 4 — Rabbi Telegram operations

**Existing foundation:** merged PR #119 and the current Telegram gateway.

**Purpose:** configure/accept the Rabbi bot, preserve Student questions and Parent replies, add sanitized support/login incidents and structured local-agent task status, and complete one owner-only private-chat canary.

**Write scope:** Telegram contracts/runtime/tests/runbooks and bounded local agent-task bridge. No Zoom, Vimeo pipeline, GHL campaign, marketing, or direct deployment work.

## Lane 5 — Marketing media and Drive

**Existing authority:** PR #183.

**Purpose:** inventory `Mishnayos New`, approved historical Drive media, and bounded local One Time media; hash/dedupe; cut 100–150 clean clips; create one Rabbi-facing Drive library and twelve editing packs; populate the repo marketing registry.

**Write scope:** `ops/marketing/**`, `scripts/marketing/**`, and new derivative Drive folders only. No product code, providers, publishing, scheduling, customer sends, or ad spend.

## Opening order

1. Keep the existing PR #131 controller open.
2. Do not start another Zoom implementation window; steer the controller to finish PR #189.
3. Start the marketing-media lane because it is mechanically isolated.
4. Start the GHL lane read-only, then Draft-only after exact audit.
5. Start the Telegram lane from current PR #131 after it records current foundation and non-overlapping paths.
6. Resume/reconcile PR #171 as the sole Vimeo/content runner lane.

## Integration order

1. Current Zoom PR #189 exact-head review and merge.
2. Source-of-truth reconciliation from PR #183 into PR #131.
3. Parent/Student activation and GHL bridge proof.
4. Telegram owner-only canary.
5. One real protected library-video acceptance through the local media runner.
6. Final lifecycle email seed and launch acceptance.

Marketing-media Drive output does not block product integration and remains a separate child PR.