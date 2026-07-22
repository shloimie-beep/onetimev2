## Summary

- Adds confidence-gated automatic edge trimming for Learning Delivery media using ffprobe, FFmpeg silencedetect output, audio presence, and transcript segment timestamps.
- Adds OpenAI transcription provenance metadata, corrected transcript/WebVTT hashing, and a real media canary runner that uploads a private prepared asset to Vimeo with active reviewed captions.
- Adds an owner/admin protected prepared Vimeo demo route at `/app/learning-delivery/demo/vimeo-autotrim` with safe duration/trim/caption status only.

## Safe Canary Evidence

- Original canary duration: `91467ms`
- Prepared duration: `79467ms`
- Trim start/end: `6000ms` / `85442ms`
- Removed start/end: `6000ms` / `6025ms`
- Transcript segments: `13`
- Vimeo privacy: `private`
- Captions: `active`
- Raw provider URL committed: `false`
- Raw transcript committed: `false`
- Contact notifications: `0`

## Validation

- `npm run learning-delivery:real-canary -- --source=<protected-operator-owned-media>`
- `npm run typecheck`
- `npx vitest run --config vitest.unit.config.ts tests/unit/content/learning-delivery.test.ts tests/unit/day-one/visible-action-registry.test.ts --reporter=dot`
- `npx vitest run --config vitest.integration.config.ts tests/integration/content/learning-delivery-demo-route.test.ts --reporter=dot`
- `npm run secret:scan`
- `git diff --check`
- `npx prettier --check <supported touched files>`

No Zoom, portal-auth, HighLevel, shared deployment, production deploy, customer notification, raw transcript, or raw provider URL changes are included.
