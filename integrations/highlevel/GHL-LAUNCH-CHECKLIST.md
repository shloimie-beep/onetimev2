# HighLevel Launch Checklist

- Validate registry: `npm run highlevel:registry:check`.
- Export current registry: `npm run highlevel:registry:export`.
- Reconcile assets before UI changes: `npm run highlevel:assets:reconcile`.
- Reconcile contact import before any write: `npm run highlevel:contacts:reconcile`.
- Keep workflows Draft until explicit approval.
- Keep OT-A1 in test routing until explicit production channel approval.
- Do not hardcode price. Use pricing custom values.
- Do not create Student contacts, Student fields or Student tags.
- Do not send messages, publish workflows, enroll production contacts or mutate Stripe in this lane.
