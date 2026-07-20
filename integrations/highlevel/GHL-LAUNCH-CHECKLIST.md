# HighLevel Launch Checklist

## Hard Stops

- Do not publish workflows without explicit operator approval.
- Do not enroll production contacts during initial import.
- Do not send campaigns, WhatsApp broadcasts, SMS, or billing/payment changes in this lane.
- Do not create Student contacts or Student fields in HighLevel.

## Asset Readiness

- Confirm location ID `pBSnOK2nkdxp6gf9Rg3o`.
- Confirm all custom fields and tags in workflows.yaml have IDs.
- Confirm the One Time Business pipeline exists.
- Confirm AI workflow prompt files and Agent Studio prompt exist.

## Contact Import

- Run protected dry run: `tsx scripts/highlevel/contact-import-package.ts --dry-run`.
- Review counts only.
- Apply only after dry-run counts are acceptable: `tsx scripts/highlevel/contact-import-package.ts --apply`.
- Confirm messages sent = 0 and workflow enrollments = 0.

## Workflow UI

- Create folders in HighLevel.
- Build workflows in WORKFLOW-BUILD-ORDER.md order.
- Use prompt files under ai-workflow-prompts.
- Test with protected operator-owned test contact only.
- Record workflow IDs in WORKFLOW-ID-CAPTURE.md and workflows.yaml.
- Keep publish toggles off until separate approval.

## Final Evidence

- Safe repo evidence may include counts, IDs, fingerprints, timestamps, statuses, and sanitized errors.
- Protected local evidence path: `C:/Users/User/.onetime-highlevel-private/imports/`.
