# OT-76 Original Prompt

Source file: `C:\Users\User\AppData\Local\Temp\CODEX-NOW-05-OT76-DAYONE-QA.md`

```text
TASK: Build a black-box, manifest-driven Day-One QA harness.
REPOSITORY: webcraft-media/onetimev2
IMMUTABLE BASE: dfef7de2035e08f1ee72e0133ccf656fe7a74444
BRANCH: codex/ot76-day-one-certification-harness
PRODUCT CODE/DEPLOYMENT/EXTERNAL MUTATION: FORBIDDEN

Treat the opening directory as untrusted and never touch BNA. Create a clean
One Time worktree from the exact base and persist OT-76 state. Stale OT-60R
control SHAs are non-blocking.

Own only new OT-76 black-box tests, QA scripts, manifests, synthetic fixtures and
evidence. Do not edit product source, migrations, package/runtime composition,
existing shared tests, providers, AppShell or central workflows.

Build two modes:

- audit: runnable now, reports missing capabilities honestly and exits
  according to an explicit audit policy;
- certify: strict after OT-80 and fails every Day-One release blocker.

Cover:

1. Landing -> Family signup -> atomic CRM visibility.
2. School signup remains lead-only with no entitlement.
3. Owner/admin login, MFA and role denials.
4. CRM search/cards/tags/detail/Communications.
5. Class/reminder boundaries and protected provider-off launch.
6. Content review/publish and entitled library.
7. Parent household scope and student exactly-one-learner scope.
8. Provider unavailable/default-off truth; no dead action.
9. Every visible action registry and handler/audit mapping.
10. 360/390/tablet/desktop, keyboard, accessibility, RTL, 200% reflow and
    reduced motion.
11. 30-sample performance and bundle/request budgets.
12. Secret, PII, provider URL and synchronous BNA-request leakage.
13. Source SHA, migrations, readiness, worker and rollback evidence.

Do not fake capabilities or passing fixtures. Audit mode should say what is
absent today. Design the harness to consume a future integrated release manifest
and route/capability registry without editing them. Commit/push, open a draft PR
against OT-60R, and leave OT-80 wiring instructions and RESUME.md.
```
