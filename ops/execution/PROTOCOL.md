# Resumable Execution Protocol

This protocol is installed by OT-RUN-RECOVERY-01 for One Time recovery and future Codex handoffs.

## Order Of Operations

1. Repository bootstrap precedes repository scripts. Verify the checkout, origin, branch, base SHA, clean state, and task ownership before running task-specific commands.
2. Prompt persistence precedes dependency gates. Preserve the received prompt, manifests, state, events, blockers, and resume instructions before implementation.
3. Unresolved prerequisites block only dependent work. Independent audits, contracts, fixture checks, and evidence preservation continue when they do not require the missing dependency.
4. Safe independent work may continue when it does not mutate production, providers, credentials, account access, DNS, payment state, or source-of-truth data.
5. Checkpoints occur immediately after prompt receipt, after each phase, every 30 minutes during active implementation, at every blocker, and before ending a session.
6. Task-owned commits, push, and a draft PR are mandatory for non-security blockers when scoped repository evidence has been created.
7. External and irreversible actions require exact authorization that names the actor, target, channel/system, payload/change, environment, and rollback or stop condition.
8. Repository state is the handoff. Chat output is explanatory only and must not be the sole source of truth for future resumption.

## Required Run Packet

Each task-owned run packet should include original prompt, input manifest, state, events, attempt report, checkpoint, implemented, remaining, decisions, blockers, commands, tests, integration manifest, and resume prompt files. Missing artifacts must be recorded explicitly rather than fabricated.

## Publication

Recovery/evidence branches may publish documentation and run-state artifacts. They must not include product source, migrations, runtime configuration, package changes, deployment changes, provider changes, secrets, raw private data, or unrelated repository cleanup.
