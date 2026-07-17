# OPS-13A Original Prompt

OPS-13A - ONE TIME REAL-DATA AND PROVIDER ACCEPTANCE PREFLIGHT

Target repository: webcraft-media/onetimev2.

This task may run while W12 feature branches are still being built. It prepares the real-data and provider acceptance operation but does not modify production data or provider state.

Dynamically resolve:
- current deployed One Time source;
- PR #61/current release state;
- active W12 branches;
- staging and production Railway identities;
- current migration and backup state.

Inventory the actual One Time/Rabbi sources available on this computer and in protected connected systems:

- Excel/CSV spreadsheets in Downloads and known legacy export locations;
- old One Time/Replit exports;
- existing One Time contacts, leads, households, members, learners, consent, suppression, and signup data;
- stored email events/webhooks/exports;
- stored WhatsApp events/exports;
- Zoom, Vimeo, Stripe-test, Telegram, Resend, OpenAI/helper, Buffer, and BNA-bridge configuration readiness.

Never commit or print contact rows, email addresses, phone numbers, message bodies, passwords, tokens, private links, or provider credentials. Record sanitized filenames, hashes, column names, counts, source ownership, and readiness only.

Produce:

1. Exact real-source inventory.
2. CRM field and tagging map.
3. Deduplication and household-reconciliation rules.
4. Counts-only import preview.
5. Conflict/manual-review categories.
6. Consent/suppression precedence.
7. Backup, rollback, and reconciliation plan.
8. Provider credential/readiness matrix without secret values.
9. Exact bounded canary plan for:
   - real Zoom meeting and controlled registrants;
   - one owned Vimeo test video;
   - Stripe test-mode checkout/webhooks;
   - controlled activation/reset emails;
   - allowlisted Telegram and WhatsApp recipients;
   - OpenAI/helper using approved class content;
   - Buffer marked blocked until an account is connected.
10. A final executable OPS-13B acceptance prompt containing no unresolved placeholders.

Preserve:
ops/codex-runs/OPS-13A/ORIGINAL-PROMPT.md
STATE.json
RESUME.md
FINAL-REPORT.md
SOURCE-INVENTORY.json
IMPORT-PREVIEW.json
PROVIDER-READINESS.json
OPS-13B-CODEX-PROMPT.md

Safe GitHub branch/commit/push/draft PR is authorized. Do not deploy, import, send, create meetings, upload videos, mutate providers, or change production during OPS-13A.
