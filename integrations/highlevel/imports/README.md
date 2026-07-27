# HighLevel Contact Imports

Protected import files live outside Git:

- CSV: C:/Users/User/.onetime-highlevel-private/imports/one-time-ghl-contacts.csv
- Manifest: C:/Users/User/.onetime-highlevel-private/imports/one-time-ghl-import-manifest.private.json
- Contact map: C:/Users/User/.onetime-highlevel-private/imports/one-time-ghl-contact-map.private.json
- Errors: C:/Users/User/.onetime-highlevel-private/imports/one-time-ghl-import-errors.private.json
- Reconciliation: C:/Users/User/.onetime-highlevel-private/imports/one-time-ghl-import-reconciliation.private.json
- Replit OT-02A protected import:
  C:/Users/User/.onetime-highlevel-private/imports/replit-ot02a-20260727.import.csv

Before any write, run `npm run highlevel:contacts:reconcile` and confirm counts-only status.

For the Replit export, run `npm run highlevel:replit:reconcile --` with explicit
`--source=`, `--ghl-export=`, `--historical-import=`, `--protected-output=`, and
`--sanitized-output=` paths. The protected CSV stays outside Git; only the aggregate,
PII-free manifest is committed.

Dedupe order:

1. Existing recorded GHL contact ID.
2. Normalized email.
3. Normalized phone.
4. Never name alone.

Do not enroll imported contacts into workflows and do not send messages from import tooling.

The OT-02A saved segment must include all three canonical source, existing-subscriber,
and migration-candidate tags and exclude `OT | Marketing Suppressed`.
