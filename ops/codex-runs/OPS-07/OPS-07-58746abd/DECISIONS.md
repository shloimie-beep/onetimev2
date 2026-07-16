# OPS-07 Decisions

## DEC-OPS-07-001 - Packet filename caveat accepted for checkpoint

- Decision: use the only unnumbered `OPS-07-CODEX-PACKET.zip` found in Downloads after validating archive safety, `OPS-07-PACKET-MANIFEST.json`, `OPS-07-CHECKSUMS.sha256`, and a secret scan.
- Caveat: the archive did not contain literal `PACKET.json` or `SHA256SUMS.txt`. It contained OPS-prefixed equivalents required by its manifest.
- Consequence: this checkpoint is resumable, but a later canonical packet with literal names may supersede it.

## DEC-OPS-07-002 - No corrective branch before OT-99

- Decision: do not create `codex/ops-07-security-privacy-corrective-58746abd`.
- Reason: candidate resolution found no `FULLY_INTEGRATED` OT-99 candidate.
- Consequence: all final corrective audit, source remediation, PR, and ready-for-security-review claims remain blocked.

## DEC-OPS-07-003 - Pre-OT99 checkpoint branch is allowed

- Decision: create `codex/ops-07-pre-ot99-checkpoint-58746abd` from `origin/main` only to persist OPS-07 state and reusable scaffolding.
- Reason: the user requested persisted OPS-07 state and a resumable checkpoint before OT-99 exists.
- Consequence: this branch is not the corrective audit branch and is not a security signoff.

## DEC-OPS-07-004 - No production or external-provider work

- Decision: keep all activity local to Git, static inspection, and packet artifacts.
- Reason: the user explicitly prohibited production access, external-service exploitation, sends, payments, deploy, provider mutation, and DNS changes.
- Consequence: provider canaries and live external assertions are blocked or prepared only as local fixture work.
