# Wave 1 — Source of Truth and Email Tone

Date: 2026-08-07 (Asia/Jerusalem)
Parent branch: `codex/one-time-complete-production-launch-20260805`
Parent head inspected: `43968d4b6163f97799e14289c2424c1001ab5c37`

## Result

This repository-only lane reconciles the documentation, registry, application-stage contract, and generated HighLevel projections. It made no HighLevel, Stripe, Zoom, email, DNS, deployment, Drive, Vimeo, or customer effect.

## Status classification

| Topic                                                   | Status                      | Evidence / boundary                                                                                                                                                                                      |
| ------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tisha B’Av one-event email and no-opt-in rule           | DECIDED                     | Exact approved copy is recorded in WNC-4.1. Event registration is not general-nurture permission.                                                                                                        |
| Voice and tone contract                                 | DECIDED                     | WNC-2.1 is compact and normative; the approved Tisha email is its positive example.                                                                                                                      |
| Public Rabbi identity                                   | DECIDED                     | The catalog and sender registry use `Rabbi Eli Scheller <rabbielischeller@onetimeonetime.com>`; provider acceptance and reply routing are separate.                                                      |
| OT-01 purpose                                           | IMPLEMENTED IN CODE         | The provider key remains compatible, while the registry and application constant explicitly name Family Account Confirmation / Active Member.                                                            |
| Pipeline stage matrix and import plan                   | DECIDED                     | The registry distinguishes Warm Leads, Free Event / Tisha B’Av Signups, Old App active/inactive, New Funnel / Pre-Registered, Active Member, and Canceled / Lost. Provider configuration is not claimed. |
| Existing-subscriber migration priority                  | DECIDED                     | OT-02A remains Draft and unenrolled pending its exact approved configuration and seed proof.                                                                                                             |
| Yaakov cancellation                                     | AUTHORIZED/PENDING          | Provider proof remains required before any status may advance.                                                                                                                                           |
| Yael request                                            | DECIDED                     | No cancellation; support follow-up only.                                                                                                                                                                 |
| Public signup behavior                                  | BLOCKED/OPEN                | Real account creation after an application event and public “Pre-register until portal ready” copy are recorded as distinct behaviors requiring an explicit phase decision.                              |
| Provider sender / reply readback                        | PROVIDER-CONFIGURED PENDING | No provider state was changed or represented as verified by this lane.                                                                                                                                   |
| Tisha delivery, import, cancellation, or migration send | BROADLY ACTIVE: NO          | This lane made no live effects.                                                                                                                                                                          |

## Validation

- Regenerated and checked `integrations/highlevel/registry/current.json` and `integrations/highlevel/workflows.yaml` from `workflow-registry.yaml` using the repository projection logic.
- Ran the canonical HighLevel registry validator through the Node execution fallback; it completed without a runtime exception.
- Ran the focused workflow-readback, visible-action-registry, and Family-signup HighLevel provider/projection tests.
- Formatted the scoped Markdown, YAML, JSON, and TypeScript files using the repository Prettier configuration.
- Completed the repository secret-pattern scan across 3,380 text files with zero findings.
- Completed the scoped diff/whitespace check across 18 scoped files with no trailing-whitespace errors.
- No full end-to-end suites were run because this is a docs/registry/projection lane and live-provider effects are out of scope.

## Follow-up required outside this lane

1. The GHL lane must save/reopen/read back the pipeline, exact sender/reply behavior, direct Tisha delivery, opportunity import, Yaakov cancellation, and Yael support record.
2. The release/landing owner must choose and record the public-signup phase before representing either pre-registration or real account creation as the current public behavior.
