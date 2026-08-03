# Tisha B'Av Funnel Decisions

- The event is modeled as a first-party One Time event under `tisha-bav-2026`; no student, parent portal, payment, password, or class entitlement data is required.
- The operator prompt is treated as a scoped authorization to prepare one Tisha B'Av Zoom event lane, but this branch does not perform an external Zoom mutation or commit any raw meeting URL.
- HighLevel is event-scoped only. The older BNA memory that says "no GHL runtime" remains true for general runtime behavior; this packet explicitly asks for one bounded One Time event sync.
- Event registration service consent is separate from optional weekly newsletter marketing consent.
- The emergency Resend fallback defaults to disabled and expires operationally after July 24, 2026.
