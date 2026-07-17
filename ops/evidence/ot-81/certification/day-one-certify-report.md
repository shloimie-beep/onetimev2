# OT-76 Day-One QA Harness Report

Mode: `certify`
Policy: `certify_strict`
Result: `certified`
Day-One certified: `true`
Current branch: `codex/ot81-dayone-certification-staging`
Current HEAD: `5644db81304048cc5c45700fb4340302193ac0af`

## Scope Proof

- Immutable base: `dfef7de2035e08f1ee72e0133ccf656fe7a74444`
- Scope base: `741af0c08ee1d43be4e220b7c6e4c77a2330adc2`
- Forbidden changed files: none
- External mutation counts: deployments 0, provider calls 0, live sends 0, production DB writes 0, payments/access 0, DNS/Railway 0.

## Gate Summary

- Total: 13
- Pass: 13
- Missing capability: 0
- Blocker: 0

## Gates

### DAYONE-01: Landing to Family signup to atomic CRM visibility

Status: `pass`

All configured signals are present.

### DAYONE-02: School signup remains lead-only with no entitlement

Status: `pass`

All configured signals are present.

### DAYONE-03: Owner/admin login, MFA, and role denials

Status: `pass`

All configured signals are present.

### DAYONE-04: CRM search, cards, tags, detail, and Communications

Status: `pass`

All configured signals are present.

### DAYONE-05: Class and reminder boundaries with protected provider-off launch

Status: `pass`

All configured signals are present.

### DAYONE-06: Content review, publish, and entitled library

Status: `pass`

All configured signals are present.

### DAYONE-07: Parent household scope and student exactly-one-learner scope

Status: `pass`

All configured signals are present.

### DAYONE-08: Provider unavailable/default-off truth and no dead action

Status: `pass`

All configured signals are present.

### DAYONE-09: Visible action registry, handler, and audit mapping

Status: `pass`

All configured signals are present.

### DAYONE-10: Responsive, keyboard, accessibility, RTL, reflow, and reduced motion

Status: `pass`

All configured signals are present.

### DAYONE-11: 30-sample performance and bundle/request budgets

Status: `pass`

All configured signals are present.

### DAYONE-12: Secret, PII, provider URL, and synchronous BNA leakage

Status: `pass`

All configured signals are present.

### DAYONE-13: Source SHA, migrations, readiness, worker, and rollback evidence

Status: `pass`

All configured signals are present.

