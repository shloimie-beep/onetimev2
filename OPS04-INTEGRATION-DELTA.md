# OPS-04 Integration Delta For OT-103

OT-103 intentionally leaves shared app/config/deployment wiring out of scope.

Required OPS-04 follow-up wiring:

- Add protected staging Zoom configuration names for server-to-server OAuth, Meeting SDK credentials, webhook secret token, host user ID, and explicit `OT103_STAGING_CANARY_AUTHORIZED`.
- Register `createZoomWebhookRouter` under the approved internal classroom webhook path using `express.raw` before global JSON parsing.
- Inject the real/staging `createZoomRestClient` based ports into `createClassroomService` only when staging credentials and canary authorization are present.
- Wire `createClassroomReminderJob` into the worker scheduler without changing sink/off defaults.
- Add the actual Zoom Meeting SDK package and switch `apps/web/src/client/classroom/zoom-sdk-adapter.ts` from the deterministic panel to a lazy SDK import only on the classroom route.
- Keep learner role `0`; owner/host start with ZAK remains a separate protected owner capability and must not share the student launch path.
- Keep raw `start_url`, reusable passcodes, access tokens, SDK secret, ZAK, private provider URLs, and raw join URLs out of logs, audits, dashboards, and non-classroom responses.
