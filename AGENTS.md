# One Time Repository Guide

## Purpose and boundaries

One Time is the standalone application for households, parents, students, Rabbi-led
learning, and the supporting adult operations needed to run it. BNA is a separate
workspace and application. Platform Console is a later, separate control plane.

This repository owns application identity, households, child privacy, enrollment,
classroom access, moderated learning, worksheets, badges, library entitlement, and
the read-only in-app transactional delivery history. It does not make One Time a
BNA surface or a replacement for a future Platform Console.

HighLevel (GHL) owns adult CRM, adult email/conversations, pipelines,
opportunities, suppression, and staff follow-up. Students never become GHL contacts.
Zoom and Vimeo are providers, never identity or entitlement authorities. Resend owns
security email. Billing and external providers remain safety-sensitive boundaries.

## Authority order

Use the first applicable source in this order:

1. Explicit operator authorization in the current task or GitHub issue.
2. The relevant current OpenSpec capability in openspec/specs/.
3. This stable repository guide and DESIGN.md.
4. The linked GitHub Issue, Project item, or PR for execution state and review.
5. Code, tests, and generated artifacts for implementation evidence.

ops/launch/ONE-TIME-AUTHORITY-INDEX.md identifies historical records. Historical
Boards, packets, emergency handoffs, snapshots, runbooks, and deployed-source claims
are evidence only unless a current OpenSpec change or GitHub task explicitly adopts a
bounded fact from them.

## Required read order

Before material work, read:

1. This file.
2. README.md and DESIGN.md when the task touches orientation or UI.
3. The relevant openspec/specs/<track>/spec.md capability.
4. The linked GitHub Issue/Project/PR and its exact remote head.
5. Only the narrow source, test, result, or historical evidence needed for the
   unresolved delta.

For a material One Time action, classify an operator statement as VISION,
LAUNCH DECISION, LATER, OFF, QUESTION, or AUTHORIZED ACTION. Brainstorming is never
authorization to change code, production, providers, accounts, or data.

## Track routing

Route work to one primary OpenSpec track:

| Track                    | Owns                                                    |
| ------------------------ | ------------------------------------------------------- |
| product                  | product boundary and launch scope                       |
| ui-shell                 | cross-role navigation and visual shells                 |
| parent-experience        | Parent learning and household journeys                  |
| student-experience       | Student learning and safe support journeys              |
| identity-access          | account, household, privacy, and entitlement boundaries |
| classroom-zoom           | recurring class and provider boundary                   |
| content-media            | library and protected media boundary                    |
| communications           | app history and adult GHL coordination                  |
| billing-access           | billing and access policy                               |
| operations-control-plane | repository operations and execution hygiene             |

Create an OpenSpec change for a material behavior or interface decision. Use a small
source-only task for documentation, test repair, and operating-system maintenance
when it does not alter product behavior.

## Branch and PR policy

- Never work directly on main; it is an old foundation, not the current
  integration base.
- Start from the exact remote base named by the linked GitHub task or PR. Re-fetch
  that head before editing; do not substitute a synthetic merge SHA.
- Use a descriptive topic branch and one focused Draft PR per coherent change.
- Do not push directly to main, force-push, or create a second competing
  controller, Board, packet graph, claim/lease system, or task board.
- Inspect git status and diffs before staging. In the contaminated Windows
  checkout, never use git add -A, git add ., or git add --all; stage only
  explicit intended paths.
- Never stage .secrets, credentials, local artifacts, generated output, or
  unrelated user changes. Do not reset, clean, overwrite, or discard another
  worktree's changes.
- A merge changes BUILT to MERGED; a deployment changes MERGED to
  DEPLOYED; only a real operator journey can establish OPERATOR ACCEPTED.

## Product and provider safety

- One Time is parent-first: the Parent learns under the Parent identity and does
  not consume one of the three child Student accounts.
- The immediate class is one recurring Sunday–Thursday 7:00 PM Asia/Jerusalem
  class, presented as Next Class rather than a launch-month grid.
- Bind one pre-created recurring Zoom meeting. Do not create per-occurrence
  meetings or Student registrants. Keep authorization, questions, attendance,
  recordings, and audit occurrence-scoped in One Time.
- Keep Rabbi-moderated private prompts, one worksheet round trip, and three fixed
  launch badges. Points, reward catalogs, public/class leaderboards, parent goals,
  editable badge rules, and extra badge levels are later or off.
- GHL work must be adult-only, provider-scoped, and covered by an exact authorized
  GHL job. Default to no send, no publish, no activation, and no enrollment.
- Do not create Student GHL contacts. Do not send credentials to GHL. Keep adult
  suppression and reply routing intact.
- Do not deploy, mutate providers, send messages, charge cards, or retry an
  unknown external effect without explicit authorization and exact reconciliation.
- Keep secrets, cookies, tokens, child-private data, raw provider links, and
  replayable provider values out of source, logs, evidence, PRs, and chat.

## Design and implementation rules

- DESIGN.md is the durable visual contract derived from the brand manifest.
  Keep the manifest as the implementation source until a separately authorized
  migration replaces it.
- Use @onetime/brand-system primitives and shells. Do not add route-local core
  controls, raw palettes, browser-default gray selects, or old-shell flashes.
- Respect accessible focus, reduced motion, responsive layouts, offline/permission
  states, and the 44px touch target where applicable.
- Keep public and authenticated bundles separate. Server-side scope is authoritative;
  browser payloads never choose account or product scope.
- Use forward-only, checksummed migrations and parameterized SQL. Do not create
  runtime schema in the web process.

## Standard verification

Run the smallest valid check while iterating, then the applicable final gate:

    npm run source-truth:check
    npm run openspec:validate
    npm run design:lint
    npm run secret:scan
    npm run format
    npm run lint
    npm run typecheck
    npm run integration
    npm run build

For auth, privacy, mutation, or provider boundaries, include one focused negative
test. Run browser suites only when the changed files require them. Reconcile every
external effect before retrying. A green test is evidence, not operator acceptance.

## Reporting

Use concise, operator-visible updates:

    [OT-CTRL]
    Current launch stage:
    What changed:
    What is proven:
    What remains:
    Agents working (max 3):
    Your action (zero or one):
    Source-of-truth state updated:

Do not claim completion from code volume, a merge, a deployment, or a provider
toggle. Record the exact source and the real operator-visible journey that passed.
