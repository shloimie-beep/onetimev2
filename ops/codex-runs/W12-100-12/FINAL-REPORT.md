# W12-100-12 Final Report

Generated: 2026-07-17

## Outcome

W12-100-12 added a read-only deterministic supply-chain inventory generator,
focused unit tests, npm vulnerability reports, and lane evidence under the
assigned ownership paths.

No staging deploy, production deploy, provider send, provider mutation,
external helper request, production database read, or production database write
was performed. External actions: 0. Production mutations: 0.

## Evidence

- Deterministic inventory:
  `ops/codex-runs/W12-100-12/DEPENDENCY-WORKFLOW-INVENTORY.json`
- Production vulnerability report:
  `ops/codex-runs/W12-100-12/npm-audit-production.json`
- Development vulnerability report:
  `ops/codex-runs/W12-100-12/npm-audit-development.json`
- SBOM generation result:
  `ops/codex-runs/W12-100-12/SBOM-GENERATION-RESULT.json`

## Findings

Medium severity:

- `github-actions-not-sha-pinned`: 17 GitHub Action uses are pinned to mutable
  tags such as `actions/checkout@v4`, `actions/setup-node@v4`, and
  `actions/upload-artifact@v4`. Exploitability: conditional.
- `docker-base-image-not-digest-pinned`: Docker/Railway base images are
  tag-pinned, not digest-pinned. Exploitability: conditional.
- `npm-install-scripts-present`: install scripts run for esbuild and fsevents
  during `npm ci`. Exploitability: conditional.
- `node24-engine-incompatibility`: optional package
  `@img/sharp-win32-ia32@0.35.3` declares `engines.node=^20.9.0` while this repo
  targets Node 24. Exploitability: not exploitable locally.
- `runtime-start-imports-devdependency-tsx`: runtime start paths import `tsx`,
  but `tsx` is declared in devDependencies. Docker works by copying
  dev-inclusive `node_modules`; an omit-dev production install would not be a
  proven boot path. Exploitability: not exploitable locally.
- `sbom-generation-blocked-or-missing`: `npm sbom --sbom-format cyclonedx` and
  package-lock-only mode both failed with `EINVALIDPURLTYPE` because workspace
  package entries have names but no versions. Exploitability: indirect.

Low severity:

- `duplicate-transitive-dependencies`: 12 transitive dependency names have more
  than one locked version.
- `env-example-name-drift`: `.env.example` is missing 17 OT75 schema names and
  73 code-referenced names.
- `runtime-dependencies-include-build-tools`: `@vitejs/plugin-react` is a
  runtime dependency build-tool candidate.
- `license-review-required`: license inventory includes LGPL Sharp/libvips
  entries and 8 unspecified local workspace package licenses.
- `tracked-binary-evidence-growth`: 210 tracked binary/evidence/media files
  total 53922979 bytes.

Info:

- `branch-protection-not-repo-local`: branch protection, required checks, review
  rules, and bypass policy are GitHub settings and cannot be proven from repo
  files alone.

## Clean Findings

- npm lockfile integrity: 0 missing registry tarball integrity hashes.
- Production npm audit: 0 vulnerabilities.
- Development npm audit: 0 vulnerabilities.
- Deprecated lockfile packages: 0 detected.
- Workflow `pull_request_target`: none detected.
- Workflow direct secret-output risk lines: none detected.
- Workflow artifact retention: no missing-retention finding.
- Workflow permissions: top-level workflow permissions are read-only.

## Recommended Upgrade Plans

Each upgrade is intentionally recorded for a separate branch; no dependency or
lockfile upgrade was applied in this lane.

| ID                               | Current                         | Target                                                      | Risk   | Affected tests                                               | Branch plan                                                                |
| -------------------------------- | ------------------------------- | ----------------------------------------------------------- | ------ | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `pin-actions-checkout-v4`        | `actions/checkout@v4`           | `actions/checkout@<reviewed-full-length-commit-sha>`        | Low    | GitHub Actions CI, `npm run secret:scan`, `npm run test`     | Workflow-hardening branch pins each action tag to a reviewed SHA.          |
| `pin-actions-setup-node-v4`      | `actions/setup-node@v4`         | `actions/setup-node@<reviewed-full-length-commit-sha>`      | Low    | GitHub Actions CI, `npm run secret:scan`, `npm run test`     | Workflow-hardening branch pins each action tag to a reviewed SHA.          |
| `pin-actions-upload-artifact-v4` | `actions/upload-artifact@v4`    | `actions/upload-artifact@<reviewed-full-length-commit-sha>` | Low    | GitHub Actions CI, `npm run secret:scan`, `npm run test`     | Workflow-hardening branch pins each action tag to a reviewed SHA.          |
| `pin-node-24-alpine-digest`      | `node:24-alpine`, `postgres:18` | `<each-base-image>@sha256:<reviewed-digest>`                | Medium | `npm run build`, `npm run e2e`, non-production Railway smoke | Docker reproducibility branch resolves and reviews each base image digest. |

## Validation

- `npm ci`: passed; 359 packages installed and npm reported 0 vulnerabilities.
- `npm audit --omit=dev --json`: passed; 0 production vulnerabilities.
- `npm audit --json`: passed; 0 development vulnerabilities.
- `npm sbom --sbom-format cyclonedx`: blocked with `EINVALIDPURLTYPE`.
- `npm sbom --package-lock-only --sbom-format cyclonedx`: blocked with
  `EINVALIDPURLTYPE`.
- `npx vitest run --config vitest.unit.config.ts tests/unit/w12-100-supply-chain-inventory.test.ts`:
  passed; 1 file, 2 tests.
- `npm run secret:scan`: passed across 1307 repo text files after closeout
  docs.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run unit`: passed; 39 files, 198 tests.
- `npm run integration`: passed; 38 files, 184 tests.
- `npm run build`: passed with the existing Vite font URL warning.

## Blockers And Operator Decisions

- SBOM generation needs a separate decision: either add workspace package
  version metadata or choose a pinned CycloneDX/SPDX generator. This lane did
  not edit package metadata or package-lock.
- Branch protection needs GitHub settings verification before launch. Repo files
  alone cannot prove required checks, review rules, or bypass policy.

## Safety

- External actions sent: 0.
- Provider resource mutations: 0.
- Production database reads: 0.
- Production database writes: 0.
- Production mutations: 0.
- Dependency upgrades: 0.
- `package-lock.json` edits: 0.
