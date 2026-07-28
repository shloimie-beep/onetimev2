# Candidate and Deployment Identity Protocol

## Immutable candidate core

I36 builds one `candidate_core` object containing exactly:

1. repository source SHA;
2. application-content SHA-256;
3. product-tree digest;
4. deployable web and worker artifact digests;
5. non-secret configuration-bundle digest;
6. migration-inventory digest;
7. frontend-asset and route/action inventory digests;
8. workflow, exact HighLevel, and provider registry digests;
9. message-catalog digest;
10. normative acceptance-contract digest;
11. supported environment-profile schema digest.

`application_content_sha256` is SHA-256 of a UTF-8 inventory sorted by
repository-relative path, one line per deployable/configuration input as
`<path>\0<sha256>\n`. It excludes Git metadata and mutable
`ops/v2.1-execution/{control,runtime,results,proofs,merge}` records.

## Canonical candidate digest

1. Parse `candidate_core` as a data object.
2. Reject floating-point values and unresolved placeholders.
3. Serialize as UTF-8 JSON with recursively sorted keys, separators `,` and
   `:`, and `ensure_ascii=false`.
4. Prefix the bytes with `ONE-TIME-V2.1-CANDIDATE` followed by one NUL byte.
5. SHA-256 the resulting bytes; the lowercase hexadecimal value is
   `canonical_candidate_digest`.

The digest preimage excludes the digest itself, manifest path/commit,
timestamps, deployment instances/times, per-environment provider assets,
evidence heads, and results. I36 computes the digest first and writes the
manifest only at
`merge/candidates/<canonical-candidate-digest>/CANDIDATE.yaml`.

## Per-case deployment identity

Candidate identity is not deployment identity. Every acceptance result binds an
immutable `DEPLOYMENT-INSTANCE.yaml` digest containing exact environment,
runtime tier, deployed artifact set, configuration, migration inventory,
route/action inventory, provider registry/assets/readbacks, and deployment
time. The result environment must be listed for that case in
`ACCEPTANCE-ENVIRONMENT-MATRIX.yaml`.

The 265 cases may and do use different allowed environments. All bind the same
candidate core. Production-specific R44/R45 gates additionally bind one exact
production-gate deployment digest; CI/staging/read-only results need not use
that deployment.
