# Vimeo Automatic Trim and Real Transcription Canary

Generated: 2026-07-24T14:10:52.161Z

## Status

- Automatic trim: accepted
- Real transcription: accepted
- Vimeo prepared asset: ready
- Captions: ready
- Admin review: accepted
- Occurrence-scoped Student playback: accepted
- Sibling denial: accepted
- Final publication state: approved and unpublished
- Provider gates after acceptance: off
- Contact notifications: 0

## Safe Timing Metadata

- Original duration ms: 2570167
- Prepared duration ms: 2483900
- Trim start ms: 76283
- Trim end ms: 2560170
- Removed start ms: 76283
- Removed end ms: 9997
- Confidence: 0.9

## Safe Hash Metadata

- Source hash: 90b6a95525bcf0117ca434e8e38b2d549d5796b33268c96b9a51ac5cfde30d64
- Prepared hash: fdc09e5d06c520b1fbe682e6f49c10bb37556633603bb8c1e94da0e60d6df44f
- Transcript hash: 783290ff2463001248e06a47a303e4a73a2a755f9952f96c918d06dba884a92a
- WebVTT hash: b80551297f9f0435486ba9915d5e504bdf13292c2ee006d0a727ce85fdad4f51
- Provider video ref digest: 9aad2c197850008c734fd7204e28ffe2fb9563a62839df3e2f840f7782b51150
- Provider text track ref digest: 8c045e52767f7bb3910d4f966767f7eab0b381f45ece466ba6894e942ed28799

Raw provider URLs and raw transcript text are not stored in this report.

## Content Factory Acceptance

- Persistent-staging runtime: `full-app-staging-live-089d724`
- Runtime source: `089d724bdd901a2a009770fecf58c6d9e68df494`
- Health/readiness: HTTP 200, ready with zero blockers
- The exact imported canary row was assigned to the existing fictional occurrence,
  reviewed under the existing fictional Admin identity, approved, and published.
- The accepted publication created one active learner entitlement and zero sibling
  entitlements.
- The entitled fictional Student opened the approved summary, five approved review
  questions, active captions, and the player through a first-party protected route.
- A fictional sibling saw no canary card; direct-route denial exposed no title,
  description, transcript, provider URL, or Vimeo URL.
- Unpublish immediately removed the canary from a fresh entitled-Student library
  and made the prior first-party lesson route metadata-safe unavailable.
- Cleanup left zero active canary content entitlements and restored the existing
  three-learner fictional occurrence roster.

## Bounded Effects

- OpenAI transcription requests: 1
- Private Vimeo assets created: 1
- Vimeo caption tracks activated: 1
- Content-factory imports: 1
- Provider or media-processing retries: 0
- Publication actions: 2; accepted publication actions: 1
- Unpublish actions: 2
- New accounts, login-code emails, customer actions, and production mutations: 0

The first fictional-Student readback caught a malformed AI-generated title. That
publication was immediately revoked, the metadata was replaced with a neutral
human-reviewed staging title, description, topics, questions, and takeaways, and
the accepted playback proof used only that corrected revision. No provider,
transcription, upload, import, account, or customer action was repeated.

## Verification

- Focused unit, including migration safety: 26/26 pass
- Focused real-PostgreSQL integration: 7/7 pass
- Local Chromium Admin upload/review/publish: pass
- Exact deployed staging entitled Student, sibling denial, and unpublish browser
  checks: pass
- Typecheck, build, lint, scoped format, secret scan, goal validation, generated
  launch-status check, and diff check: pass
- Draft PR #117 GitHub checks: 4/4 pass

The local in-memory multi-step Chromium continuation is blocked after its passing
Admin step because `pg-mem` does not support the existing production portal query's
join lookup. The same Student, sibling, protected-player, and revocation path passed
against deployed staging and real PostgreSQL.
