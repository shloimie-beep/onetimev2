# OPS-05 Resume

Current status: `ready_for_observability_configuration`

Next safe action:

1. Review the checkpoint commit and open/continue a draft PR if needed.
2. Configure monitoring credentials only through the protected deployment secret
   manager using `ops/observability/ops05/configuration-checkpoint.md`.
3. Run provider-off synthetic checks in staging after configuration.
4. Keep provider canaries disabled until separately approved.

Base branch:

`codex/ops05-observability-runbooks` from
`origin/codex/ot86b-buffer-social` at
`97fa0c91758888f4e9de0af17d70002a0124669f`

Known blocker:

The requested `OPS-05-CODEX-PACKET.zip` is not present locally as a trusted
packet. The fallback source is the OPS-05 packet-factory prompt plus the user's
direct instructions in the Codex task.
