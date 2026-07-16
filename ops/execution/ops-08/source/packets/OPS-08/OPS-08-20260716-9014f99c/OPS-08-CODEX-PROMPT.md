# OPS-08 Direct-to-Codex Execution Prompt

You are the principal DNS, email deliverability, application rollout, and rollback engineer for **OPS-08**.

Packet ID: **OPS-08-20260716-9014f99c**  
Source repository: **webcraft-media/onetimev2**  
Current launch origin: **https://join.onetimeonetime.com**  
Root hostname: **onetimeonetime.com**  
DNS/email-DNS control plane: **GoDaddy only; GoDaddy is not the application host**  
Production cutover authorization: **absent**

Execute OPS-08 as a fail-closed readiness and repository-hardening task. Do not perform an apex/root DNS change, launch-domain DNS change, production deployment, production callback mutation, email-DNS mutation, real send, live payment, or production cutover.

## OPS-08 mandatory first action: persist state

Before running discovery commands that can change local files, set `OPS08_PACKET_ROOT` to the directory containing `OPS-08-PACKET-MANIFEST.json` and `CHECKSUMS.sha256`, then run:

`node "$OPS08_PACKET_ROOT/tools/OPS-08-toolkit.mjs" init-state --root "$PWD" --packet-root "$OPS08_PACKET_ROOT"`

The command must create these paths in the working tree before any other repository modification:

- `ops/codex-runs/OPS-08/state.json`
- `ops/codex-runs/OPS-08/command-log.ndjson`
- `ops/evidence/ops-08/index.json`
- `ops/release/ops-08/`

Write `state.json` atomically with:

- `task_id`: `OPS-08`
- `packet_id`: `OPS-08-20260716-9014f99c`
- `phase`: `state_persisted`
- `status`: `audit_in_progress`
- `cutover_authorized`: `false`
- `root_dns_mutation_authorized`: `false`
- `launch_domain_mutation_authorized`: `false`
- `production_deployment_authorized`: `false`
- `production_provider_mutation_authorized`: `false`
- `email_dns_mutation_authorized`: `false`
- `real_send_authorized`: `false`
- `selected_source_sha`: `null`
- `mutation_count`: `0`
- UTC creation/update timestamps
- SHA-256 of the packet manifest and packet checksum file
- packet integrity status, initially `unverified`
- evidence index path
- resume instruction

Append each command, exit code, start/end timestamp, phase, and redacted output digest to `command-log.ndjson`. Never log credentials, raw private DNS target values, provider secrets, mailbox credentials, protected Zoom launch URLs, Vimeo tokens, Stripe keys, webhook secrets, or session material.

After every phase, atomically update state. A stopped run must be resumable from state and evidence without repeating external mutations.

## OPS-08 packet integrity

1. Verify `CHECKSUMS.sha256`.
2. Validate packet JSON files and CSV headers.
3. Read:
   - `evidence/OPS-08-OBSERVED-BASELINE.json`
   - `evidence/OPS-08-OFFICIAL-GUIDANCE.md`
   - `schemas/OPS-08-INVENTORY.schema.json`
   - `schemas/OPS-08-AUTHORIZATION.schema.json`
   - `schemas/OPS-08-REVERSIBLE-CHANGE.schema.json`
   - `matrices/OPS-08-CALLBACK-MATRIX.csv`
   - `matrices/OPS-08-DELIVERABILITY-MATRIX.csv`
   - `acceptance/OPS-08-ACCEPTANCE-GATES.md`
   - `runbooks/OPS-08-CUTOVER.md`
   - `runbooks/OPS-08-ROLLBACK.md`
4. If packet material is missing or a checksum, manifest path set, or file count fails, set `status=blocked_packet_integrity` and stop.

## OPS-08 immutable safety constraints

These constraints outrank convenience and provider prompts:

- Do not modify `onetimeonetime.com` root/apex DNS, forwarding, TLS, hosting target, nameservers, or DNSSEC.
- Do not modify `join.onetimeonetime.com`.
- Do not change MX, SPF, DKIM, DMARC, return-path, mailbox, or email routing.
- Do not deploy to any Railway project/environment that is or might be production-linked.
- Do not add/remove/rotate a production provider callback.
- Stripe is TEST mode only; no live key, live charge, live checkout, or live webhook action.
- Do not expose or use a protected Zoom launch URL except through approved protected configuration and a non-production canary.
- Do not make a live Vimeo mutation unless a later authorization explicitly permits it; OPS-08 audit is read-only.
- Do not send email, WhatsApp, Telegram, or support messages to real recipients.
- Do not create real users, grant access, or migrate production data.
- Do not merge or deploy an open draft PR as a side effect.
- Do not infer DNS values, Railway targets, callback URLs, or email providers from brand/domain names.
- Do not store raw private provider/DNS values in Git, chat, screenshots, command logs, or packet evidence.
- `ready_for_dns_operator_action` is readiness, not authorization.

Any later executable authorization must validate against the packet schema and bind the exact target SHA, Railway project/environment/service/deployment digests, target port, `/health` path, `healthcheck.railway.app` request host, private DNS and callback change/rollback digests, application-configuration change-set digest, maintenance window, monitor, rollback owner, migration evidence, and explicit root-mutation decision.

## OPS-08 source audit and selection

The default branch is a foundation-only commit at audit time:

- `main`: `610b585f3d221addd4e7b824c92a5cc256cffcf9`

The packet observed these draft anchors:

- OT-81 PR 25: `809480bb5581c4104f64c4c04a5c92fff8aaa7cf`
- OT-83 PR 27: `a02d1d254ae0d17804fb657079a7871567260ea2`
- OT-86A PR 31: `87a1bb7ffd6a2fa0d016a1831894d430aa2ee065`
- OT-86B PR 32 audit anchor: `97fa0c91758888f4e9de0af17d70002a0124669f`

Re-fetch all refs and newer PRs. Build a branch/commit ancestry graph. Do not assume the audit anchor is still the preferred source.

Select exactly one immutable implementation base using this algorithm:

1. It is reachable from the repository.
2. It contains an accepted OT-81-equivalent product/certification foundation.
3. It contains the application capabilities whose domains/callbacks are being prepared.
4. It does not silently omit a currently live landing, signup, login, reminder, Stripe TEST, Zoom, Vimeo, support, or deep-link contract.
5. It has no known source-convergence conflict that would make a domain hardening patch misleading.
6. Its SHA, branch, PR, ancestry commands, and selection rationale are persisted.

If no single SHA satisfies the algorithm, do not fabricate convergence. Set `status=blocked_source_convergence_required`, produce the exact branch/ancestry matrix, and limit work to branch-neutral packet/tooling changes that cannot mask the blocker.

When one SHA is valid, create the code branch:

`codex/ops-08-domain-email-cutover-readiness-9014f99c`

from the exact SHA. Do not create the branch from a moving branch name after selection.

## OPS-08 mandatory continuation order

This file is the direct prompt entrypoint. Execute the following packet chapters in this exact order; they are normative continuations of this prompt, not optional references:

1. `prompt/OPS-08-INVENTORY.md`
2. `prompt/OPS-08-REPOSITORY-IMPLEMENTATION.md`
3. `prompt/OPS-08-STATE-DELIVERY.md`

Do not stop after this entrypoint. A result that omits any continuation chapter is incomplete.
