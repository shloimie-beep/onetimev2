# HighLevel Contact Imports

Protected import files live outside Git:

- CSV: C:/Users/User/.onetime-highlevel-private/imports/one-time-ghl-contacts.csv
- Manifest: C:/Users/User/.onetime-highlevel-private/imports/one-time-ghl-import-manifest.private.json
- Contact map: C:/Users/User/.onetime-highlevel-private/imports/one-time-ghl-contact-map.private.json
- Errors: C:/Users/User/.onetime-highlevel-private/imports/one-time-ghl-import-errors.private.json
- Reconciliation: C:/Users/User/.onetime-highlevel-private/imports/one-time-ghl-import-reconciliation.private.json

Before any write, run `npm run highlevel:contacts:reconcile` and confirm counts-only status.

Dedupe order:

1. Existing recorded GHL contact ID.
2. Normalized email.
3. Normalized phone.
4. Never name alone.

Do not enroll imported contacts into workflows and do not send messages from import tooling.
