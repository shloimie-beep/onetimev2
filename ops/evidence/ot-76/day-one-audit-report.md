# OT-76 Day-One QA Harness Report

Mode: `audit`
Policy: `audit_zero_unless_harness_or_scope_failure`
Result: `audit_complete_not_certified`
Day-One certified: `false`
Current branch: `codex/ot80-one-shot-final-convergence`
Current HEAD: `a95b4e3c2b7210f66f142322d2adcb900eb6890a`

## Scope Proof

- Immutable base: `dfef7de2035e08f1ee72e0133ccf656fe7a74444`
- Scope base: `bc2bcf2c7e16b5f1885aa65a2904f07578a18169`
- Forbidden changed files: none
- External mutation counts: deployments 0, provider calls 0, live sends 0, production DB writes 0, payments/access 0, DNS/Railway 0.

## Gate Summary

- Total: 13
- Pass: 3
- Missing capability: 0
- Blocker: 10

## Gates

### DAYONE-01: Landing to Family signup to atomic CRM visibility

Status: `pass`

All configured signals are present.

### DAYONE-02: School signup remains lead-only with no entitlement

Status: `blocker`

2 configured signal(s) missing or incomplete.

Missing or incomplete signals:
- `school-thank-you-test`: tests/e2e/landing-signup.spec.ts contains required text
- `capability-school-lead-only`: capability school_signup_lead_only has allowed status

### DAYONE-03: Owner/admin login, MFA, and role denials

Status: `pass`

All configured signals are present.

### DAYONE-04: CRM search, cards, tags, detail, and Communications

Status: `blocker`

1 configured signal(s) missing or incomplete.

Missing or incomplete signals:
- `capability-crm-communications`: capability crm_search_cards_tags_detail_communications has allowed status

### DAYONE-05: Class and reminder boundaries with protected provider-off launch

Status: `blocker`

1 configured signal(s) missing or incomplete.

Missing or incomplete signals:
- `capability-class-reminder-provider-off`: capability class_reminder_provider_off_launch has allowed status

### DAYONE-06: Content review, publish, and entitled library

Status: `blocker`

1 configured signal(s) missing or incomplete.

Missing or incomplete signals:
- `capability-content-library`: capability content_review_publish_entitled_library has allowed status

### DAYONE-07: Parent household scope and student exactly-one-learner scope

Status: `blocker`

1 configured signal(s) missing or incomplete.

Missing or incomplete signals:
- `capability-parent-student`: capability parent_household_student_exactly_one_learner has allowed status

### DAYONE-08: Provider unavailable/default-off truth and no dead action

Status: `blocker`

1 configured signal(s) missing or incomplete.

Missing or incomplete signals:
- `capability-provider-default-off`: capability provider_default_off_no_dead_action has allowed status

### DAYONE-09: Visible action registry, handler, and audit mapping

Status: `blocker`

1 configured signal(s) missing or incomplete.

Missing or incomplete signals:
- `capability-action-registry`: capability visible_action_registry_handler_audit has allowed status

### DAYONE-10: Responsive, keyboard, accessibility, RTL, reflow, and reduced motion

Status: `blocker`

1 configured signal(s) missing or incomplete.

Missing or incomplete signals:
- `capability-responsive-a11y`: capability responsive_a11y_rtl_reflow_reduced_motion has allowed status

### DAYONE-11: 30-sample performance and bundle/request budgets

Status: `blocker`

1 configured signal(s) missing or incomplete.

Missing or incomplete signals:
- `capability-performance`: capability performance_30_sample_budgets has allowed status

### DAYONE-12: Secret, PII, provider URL, and synchronous BNA leakage

Status: `pass`

All configured signals are present.

### DAYONE-13: Source SHA, migrations, readiness, worker, and rollback evidence

Status: `blocker`

1 configured signal(s) missing or incomplete.

Missing or incomplete signals:
- `capability-source-readiness`: capability source_migrations_readiness_worker_rollback has allowed status

