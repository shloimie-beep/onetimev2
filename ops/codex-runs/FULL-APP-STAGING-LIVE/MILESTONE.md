# FULL-APP-STAGING-LIVE

Status: live on staging.

Staging URL: https://ot99-web-staging.up.railway.app
Login URL: https://ot99-web-staging.up.railway.app/login

Branch: `codex/full-app-staging-live`
Base: `codex/one-time-finish-now-20260719`
Deployed source: `944f46b5435d648e6e175c69746ca7a4895ffec4`

Staging deployment:

- Web: `59112f43-29be-4a14-a2da-d932d798d78e`
- Worker: `4f823e75-aee6-4524-bb36-8a7ced027355`
- Version: `full-app-staging-live-944f46b`
- Latest migration: `2209_class_series_scope_unique`

Preview status:

- Admin password reaches the email challenge screen.
- Parent login reaches the Parent Portal with three active learners.
- Student login reaches the Student Portal with demo class, Vimeo lesson, progress, rewards, and leaderboard.
- Fourth active learner creation is rejected by the three-student household cap.
- Zoom is in managed sink fallback mode with protected launch descriptors only.
- Production was not changed.

Validation:

- `npm ci`
- `npm run typecheck`
- `npm run build`
- `npm run secret:scan`
- `npm run zoom:demo-students`
- Focused unit tests: 18 passed.
- Focused integration tests: 14 passed.
- Live browser smoke: passed.

Safe screenshots:

- `ops/codex-runs/FULL-APP-STAGING-LIVE/screenshots/admin-email-challenge.png`
- `ops/codex-runs/FULL-APP-STAGING-LIVE/screenshots/parent-dashboard.png`
- `ops/codex-runs/FULL-APP-STAGING-LIVE/screenshots/student-dashboard-mobile.png`
