NO-WRITE PREFLIGHT — STOP BEFORE EDITING ON ANY FAILURE

You are executing OT-65: Stripe test-mode activation and Parent Billing for the
standalone One Time product.

Do not begin by editing code. Do not create a branch or worktree until every Phase 0
gate below passes. Do not infer a missing value. Do not weaken or bypass a failed
gate. Do not continue from a dirty, reused, diverged, incomplete, or ambiguously owned
worktree.

SOURCE SPECIFICATION

This execution prompt was generated from PG-17 and preserves its billing,
authorization, activation, evidence, and safety requirements:
:contentReference[oaicite:0]{index=0}

===============================================================================
0. DIRECTOR-APPROVED EXECUTION VALUES
===============================================================================

Repository:

webcraft-media/onetimev2

The following values are intentionally unresolved. Every placeholder must be replaced
with an exact, written, internally consistent value before this prompt is run.

Required accepted-head and base values:

- ACCEPTED_OT60_CONVERGED_HEAD_SHA =
  `{{ACCEPTED_OT60_CONVERGED_HEAD_SHA}}`
- ACCEPTED_OT46_STRIPE_FOUNDATION_HEAD_SHA =
  `{{ACCEPTED_OT46_STRIPE_FOUNDATION_HEAD_SHA}}`
- ACCEPTED_OT52_PARENT_PORTAL_HEAD_SHA =
  `{{ACCEPTED_OT52_PARENT_PORTAL_HEAD_SHA}}`
- DIRECTOR_APPROVED_OT65_BASE_SHA =
  `{{DIRECTOR_APPROVED_OT65_BASE_SHA}}`

Required Stripe execution and commercial values:

- APPROVED_STRIPE_EXECUTION_MODE =
  `{{APPROVED_STRIPE_EXECUTION_MODE}}`
- APPROVED_BILLING_CURRENCY =
  `{{APPROVED_BILLING_CURRENCY}}`
- APPROVED_RECURRING_PRICE_MINOR_UNITS =
  `{{APPROVED_RECURRING_PRICE_MINOR_UNITS}}`
- APPROVED_FREE_ACCESS_OR_TRIAL_POLICY =
  `{{APPROVED_FREE_ACCESS_OR_TRIAL_POLICY}}`
- APPROVED_TEST_STRIPE_PRODUCT_ID =
  `{{APPROVED_TEST_STRIPE_PRODUCT_ID}}`
- APPROVED_TEST_STRIPE_PRICE_ID =
  `{{APPROVED_TEST_STRIPE_PRICE_ID}}`
- APPROVED_TAX_POLICY =
  `{{APPROVED_TAX_POLICY}}`
- APPROVED_REFUND_POLICY =
  `{{APPROVED_REFUND_POLICY}}`
- APPROVED_CANCELLATION_POLICY =
  `{{APPROVED_CANCELLATION_POLICY}}`
- APPROVED_ENTITLEMENT_EFFECTIVE_POLICY =
  `{{APPROVED_ENTITLEMENT_EFFECTIVE_POLICY}}`
- APPROVED_BILLING_SUPPORT_OWNER =
  `{{APPROVED_BILLING_SUPPORT_OWNER}}`

Additional values required because OT-65 cannot safely derive them from price names,
landing-page copy, historical discussions, or Stripe defaults:

- DIRECTOR_APPROVED_OT65_BASE_BRANCH =
  `{{DIRECTOR_APPROVED_OT65_BASE_BRANCH}}`
- APPROVED_TEST_STRIPE_ACCOUNT_ID =
  `{{APPROVED_TEST_STRIPE_ACCOUNT_ID}}`
- APPROVED_TEST_STRIPE_PORTAL_CONFIGURATION_ID =
  `{{APPROVED_TEST_STRIPE_PORTAL_CONFIGURATION_ID}}`
- APPROVED_TEST_STRIPE_WEBHOOK_ENDPOINT_ID =
  `{{APPROVED_TEST_STRIPE_WEBHOOK_ENDPOINT_ID}}`
- APPROVED_STRIPE_API_VERSION =
  `{{APPROVED_STRIPE_API_VERSION}}`
- APPROVED_STAGING_PUBLIC_ORIGIN =
  `{{APPROVED_STAGING_PUBLIC_ORIGIN}}`
- APPROVED_STAGING_DEPLOYMENT_TARGET =
  `{{APPROVED_STAGING_DEPLOYMENT_TARGET}}`
- APPROVED_OT65_COMMERCIAL_DECISION_JSON =
  `{{APPROVED_OT65_COMMERCIAL_DECISION_JSON}}`

`APPROVED_OT65_COMMERCIAL_DECISION_JSON` must be canonical single-line JSON with all
of the following explicit fields:

- `billing_model`: must say whether this is a recurring subscription or another
  model. OT-65 may continue only when this equals `recurring_subscription`.
- `recurring_interval`: exact Stripe interval such as `month` or `year`.
- `recurring_interval_count`: positive integer.
- `quantity`: exact fixed quantity. Browser-adjustable quantity is prohibited.
- `billing_timezone`: exact IANA timezone.
- `plan_key`: immutable internal plan key.
- `plan_display_name`: truthful parent-facing name.
- `tier_key`: immutable approved tier key.
- `benefit_keys`: exact class/library benefits granted by the tier.
- `payment_method_types`: exact approved Stripe payment-method types.
- `allow_promotion_codes`: exact boolean. It must be `false` unless separately
  approved.
- `receipt_invoice_policy`: exact receipt, invoice, email, history, and opening rules.
- `portal_allowed_actions`: exact payment-method, cancellation, resumption, and plan
  actions enabled in the approved portal configuration.
- `failed_payment_policy`: grace duration, recovery behavior, and suspension behavior.
- `dispute_policy`: internal access behavior while a dispute is open and after it
  closes.
- `grandfathering_policy`: exact treatment of existing free or paid access.
- `free_access_expiration_behavior`: exact transition at the approved free-access or
  trial boundary.

The policy placeholders must be canonical single-line JSON rather than ambiguous
prose. Dates must use ISO 8601 timestamps with offsets or UTC `Z`; policies must name
the governing IANA timezone. A symbolic date such as “Rosh Hashanah” is insufficient
without an exact timestamp and timezone.

The remembered candidate of `$67`, free access until Rosh Hashanah, or a fixed
30-day trial is not authorization. Do not use any remembered amount or policy unless
the resolved values above state it exactly.

The only permitted execution-mode literal for OT-65 is:

TEST_MODE_STAGING_CANARY

Therefore:

- `{{APPROVED_STRIPE_EXECUTION_MODE}}` must resolve exactly to
  `TEST_MODE_STAGING_CANARY`.
- `LIVE_STRIPE_CHARGES_AUTHORIZED` must remain exactly `NO`.
- Do not create any alias for either value.
- No OT-65 source, configuration, test, deployment, or operator action may change
  `LIVE_STRIPE_CHARGES_AUTHORIZED` from `NO`.

The approved base branch must identify the branch against which the draft OT-65 PR
will be opened. Its remote head must equal
`{{DIRECTOR_APPROVED_OT65_BASE_SHA}}`. A branch that merely contains the approved SHA
but has advanced beyond it is not sufficient.

===============================================================================
1. PHASE 0A — PLACEHOLDER AND MODE VALIDATION; NO REPOSITORY WRITES
===============================================================================

Set a restrictive shell mode. Do not use `set -x`, because command tracing can expose
protected environment values.

Run:

    set -euo pipefail
    umask 077

Copy the resolved nonsecret gate values into shell variables without changing their
contents. Policy JSON must remain canonical single-line JSON.

    OT65_ACCEPTED_OT60='{{ACCEPTED_OT60_CONVERGED_HEAD_SHA}}'
    OT65_ACCEPTED_OT46='{{ACCEPTED_OT46_STRIPE_FOUNDATION_HEAD_SHA}}'
    OT65_ACCEPTED_OT52='{{ACCEPTED_OT52_PARENT_PORTAL_HEAD_SHA}}'
    OT65_BASE='{{DIRECTOR_APPROVED_OT65_BASE_SHA}}'
    OT65_BASE_BRANCH='{{DIRECTOR_APPROVED_OT65_BASE_BRANCH}}'
    OT65_MODE='{{APPROVED_STRIPE_EXECUTION_MODE}}'
    OT65_CURRENCY='{{APPROVED_BILLING_CURRENCY}}'
    OT65_AMOUNT_MINOR='{{APPROVED_RECURRING_PRICE_MINOR_UNITS}}'
    OT65_FREE_POLICY='{{APPROVED_FREE_ACCESS_OR_TRIAL_POLICY}}'
    OT65_STRIPE_ACCOUNT='{{APPROVED_TEST_STRIPE_ACCOUNT_ID}}'
    OT65_STRIPE_PRODUCT='{{APPROVED_TEST_STRIPE_PRODUCT_ID}}'
    OT65_STRIPE_PRICE='{{APPROVED_TEST_STRIPE_PRICE_ID}}'
    OT65_STRIPE_PORTAL_CONFIG='{{APPROVED_TEST_STRIPE_PORTAL_CONFIGURATION_ID}}'
    OT65_STRIPE_WEBHOOK_ENDPOINT='{{APPROVED_TEST_STRIPE_WEBHOOK_ENDPOINT_ID}}'
    OT65_STRIPE_API_VERSION='{{APPROVED_STRIPE_API_VERSION}}'
    OT65_TAX_POLICY='{{APPROVED_TAX_POLICY}}'
    OT65_REFUND_POLICY='{{APPROVED_REFUND_POLICY}}'
    OT65_CANCELLATION_POLICY='{{APPROVED_CANCELLATION_POLICY}}'
    OT65_ENTITLEMENT_POLICY='{{APPROVED_ENTITLEMENT_EFFECTIVE_POLICY}}'
    OT65_SUPPORT_OWNER='{{APPROVED_BILLING_SUPPORT_OWNER}}'
    OT65_COMMERCIAL_JSON='{{APPROVED_OT65_COMMERCIAL_DECISION_JSON}}'
    OT65_STAGING_ORIGIN='{{APPROVED_STAGING_PUBLIC_ORIGIN}}'
    OT65_STAGING_TARGET='{{APPROVED_STAGING_DEPLOYMENT_TARGET}}'
    LIVE_STRIPE_CHARGES_AUTHORIZED='NO'

Validate every value before doing anything else:

    required_names=(
      OT65_ACCEPTED_OT60
      OT65_ACCEPTED_OT46
      OT65_ACCEPTED_OT52
      OT65_BASE
      OT65_BASE_BRANCH
      OT65_MODE
      OT65_CURRENCY
      OT65_AMOUNT_MINOR
      OT65_FREE_POLICY
      OT65_STRIPE_ACCOUNT
      OT65_STRIPE_PRODUCT
      OT65_STRIPE_PRICE
      OT65_STRIPE_PORTAL_CONFIG
      OT65_STRIPE_WEBHOOK_ENDPOINT
      OT65_STRIPE_API_VERSION
      OT65_TAX_POLICY
      OT65_REFUND_POLICY
      OT65_CANCELLATION_POLICY
      OT65_ENTITLEMENT_POLICY
      OT65_SUPPORT_OWNER
      OT65_COMMERCIAL_JSON
      OT65_STAGING_ORIGIN
      OT65_STAGING_TARGET
    )

    for name in "${required_names[@]}"; do
      value="${!name}"
      if [ -z "$value" ] || [[ "$value" == *'{{'* ]] || [[ "$value" == *'}}'* ]]; then
        printf 'BLOCKED_UNRESOLVED_PLACEHOLDER=%s\n' "$name" >&2
        exit 64
      fi
    done

    sha_re='^[0-9a-f]{40}$'
    for name in OT65_ACCEPTED_OT60 OT65_ACCEPTED_OT46 OT65_ACCEPTED_OT52 OT65_BASE; do
      value="${!name}"
      if ! [[ "$value" =~ $sha_re ]]; then
        printf 'BLOCKED_NON_IMMUTABLE_SHA=%s\n' "$name" >&2
        exit 64
      fi
    done

    if [ "$OT65_MODE" != 'TEST_MODE_STAGING_CANARY' ]; then
      printf 'BLOCKED_UNAPPROVED_STRIPE_MODE=%s\n' "$OT65_MODE" >&2
      exit 64
    fi

    if [ "$LIVE_STRIPE_CHARGES_AUTHORIZED" != 'NO' ]; then
      printf 'BLOCKED_LIVE_STRIPE_AUTHORIZATION\n' >&2
      exit 64
    fi

    if ! [[ "$OT65_CURRENCY" =~ ^[a-z]{3}$ ]]; then
      printf 'BLOCKED_INVALID_CURRENCY\n' >&2
      exit 64
    fi

    if ! [[ "$OT65_AMOUNT_MINOR" =~ ^[0-9]+$ ]]; then
      printf 'BLOCKED_INVALID_MINOR_UNIT_AMOUNT\n' >&2
      exit 64
    fi

    if ! [[ "$OT65_STRIPE_ACCOUNT" =~ ^acct_[A-Za-z0-9]+$ ]]; then
      printf 'BLOCKED_INVALID_TEST_STRIPE_ACCOUNT_ID\n' >&2
      exit 64
    fi

    if ! [[ "$OT65_STRIPE_PRODUCT" =~ ^prod_[A-Za-z0-9]+$ ]]; then
      printf 'BLOCKED_INVALID_TEST_STRIPE_PRODUCT_ID\n' >&2
      exit 64
    fi

    if ! [[ "$OT65_STRIPE_PRICE" =~ ^price_[A-Za-z0-9]+$ ]]; then
      printf 'BLOCKED_INVALID_TEST_STRIPE_PRICE_ID\n' >&2
      exit 64
    fi

    if ! [[ "$OT65_STRIPE_PORTAL_CONFIG" =~ ^bpc_[A-Za-z0-9]+$ ]]; then
      printf 'BLOCKED_INVALID_PORTAL_CONFIGURATION_ID\n' >&2
      exit 64
    fi

    if ! [[ "$OT65_STRIPE_WEBHOOK_ENDPOINT" =~ ^we_[A-Za-z0-9]+$ ]]; then
      printf 'BLOCKED_INVALID_WEBHOOK_ENDPOINT_ID\n' >&2
      exit 64
    fi

Validate all JSON policy values without normalizing or rewriting them:

    node --input-type=module <<'NODE'
    const values = {
      commercial: process.env.OT65_COMMERCIAL_JSON,
      free: process.env.OT65_FREE_POLICY,
      tax: process.env.OT65_TAX_POLICY,
      refund: process.env.OT65_REFUND_POLICY,
      cancellation: process.env.OT65_CANCELLATION_POLICY,
      entitlement: process.env.OT65_ENTITLEMENT_POLICY,
    };

    for (const [name, value] of Object.entries(values)) {
      if (!value) throw new Error(`BLOCKED_MISSING_JSON_${name.toUpperCase()}`);
      let parsed;
      try {
        parsed = JSON.parse(value);
      } catch {
        throw new Error(`BLOCKED_INVALID_JSON_${name.toUpperCase()}`);
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`BLOCKED_NON_OBJECT_JSON_${name.toUpperCase()}`);
      }
    }

    const commercial = JSON.parse(values.commercial);
    const required = [
      'billing_model',
      'recurring_interval',
      'recurring_interval_count',
      'quantity',
      'billing_timezone',
      'plan_key',
      'plan_display_name',
      'tier_key',
      'benefit_keys',
      'payment_method_types',
      'allow_promotion_codes',
      'receipt_invoice_policy',
      'portal_allowed_actions',
      'failed_payment_policy',
      'dispute_policy',
      'grandfathering_policy',
      'free_access_expiration_behavior',
    ];

    for (const key of required) {
      if (!(key in commercial)) {
        throw new Error(`BLOCKED_MISSING_COMMERCIAL_FIELD_${key}`);
      }
    }

    if (commercial.billing_model !== 'recurring_subscription') {
      throw new Error('BLOCKED_OT65_REQUIRES_APPROVED_RECURRING_SUBSCRIPTION_MODEL');
    }

    if (
      !Number.isInteger(commercial.recurring_interval_count) ||
      commercial.recurring_interval_count < 1
    ) {
      throw new Error('BLOCKED_INVALID_RECURRING_INTERVAL_COUNT');
    }

    if (!Number.isInteger(commercial.quantity) || commercial.quantity < 1) {
      throw new Error('BLOCKED_INVALID_FIXED_QUANTITY');
    }

    if (
      !Array.isArray(commercial.benefit_keys) ||
      commercial.benefit_keys.length === 0
    ) {
      throw new Error('BLOCKED_MISSING_PLAN_BENEFITS');
    }

    if (
      !Array.isArray(commercial.payment_method_types) ||
      commercial.payment_method_types.length === 0
    ) {
      throw new Error('BLOCKED_MISSING_PAYMENT_METHOD_POLICY');
    }

    process.stdout.write('commercial_decisions=validated\n');
    NODE

Export the variables only for the current shell used by the validation commands. Do
not save them to a file. None of these variables contains a Stripe credential.

Stop immediately if:

- any value is missing, unresolved, malformed, or internally contradictory;
- the commercial JSON omits the recurring interval, tier, benefit, payment-method,
  invoice, grace, dispute, or grandfathering rules;
- the approved price amount and free/trial rules cannot coexist as written;
- the tax, refund, cancellation, entitlement, or portal policy refers to an
  unapproved plan, price, currency, quantity, account, or mode;
- any policy uses relative or symbolic dates without exact timestamps and timezone;
- any value was inferred from historical BNA code, a screenshot, a Stripe object
  name, a fixture, landing-page copy, or memory.

===============================================================================
2. PHASE 0B — REPOSITORY IDENTITY, CLEANLINESS, AND COMMIT CONTAINMENT
===============================================================================

This phase may read Git metadata and may run `git fetch --prune --tags origin`.
Fetching is permitted only to update remote-tracking metadata. It must not change the
checked-out commit, source files, branch, index, or worktree.

Locate the existing repository. Do not clone into an arbitrary location and do not
switch the current worktree:

    REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
      printf 'BLOCKED_REPOSITORY_NOT_PRESENT\n' >&2
      exit 65
    }
    cd "$REPO_ROOT"

Verify the remote without assuming HTTPS versus SSH syntax:

    REMOTE_URL="$(git config --get remote.origin.url || true)"
    if ! printf '%s\n' "$REMOTE_URL" |
      grep -Eq 'github\.com[:/]webcraft-media/onetimev2(\.git)?$'; then
      printf 'BLOCKED_WRONG_REPOSITORY_REMOTE\n' >&2
      exit 65
    fi

The source worktree must already be clean:

    if [ -n "$(git status --porcelain=v1 --untracked-files=all)" ]; then
      printf 'BLOCKED_DIRTY_SOURCE_WORKTREE\n' >&2
      git status --short >&2
      exit 65
    fi

Do not run `git reset`, `git clean`, `git restore`, `git checkout`, or `git switch`
to make it pass.

Reject shallow, replaced, or grafted history:

    if [ "$(git rev-parse --is-shallow-repository)" != 'false' ]; then
      printf 'BLOCKED_SHALLOW_REPOSITORY\n' >&2
      exit 65
    fi

    if [ -n "$(git replace -l)" ]; then
      printf 'BLOCKED_GIT_REPLACEMENTS_PRESENT\n' >&2
      exit 65
    fi

Read the remote graph, then fetch metadata and prove that the checked-out commit did
not move:

    PRE_FETCH_HEAD="$(git rev-parse HEAD)"
    git ls-remote --heads --tags origin >/dev/null
    git fetch --prune --tags origin
    POST_FETCH_HEAD="$(git rev-parse HEAD)"

    if [ "$PRE_FETCH_HEAD" != "$POST_FETCH_HEAD" ]; then
      printf 'BLOCKED_HEAD_CHANGED_DURING_FETCH\n' >&2
      exit 65
    fi

The source checkout must already be exactly the approved base:

    if [ "$POST_FETCH_HEAD" != "$OT65_BASE" ]; then
      printf 'BLOCKED_CHECKED_OUT_HEAD_DIFFERS_FROM_APPROVED_BASE\n' >&2
      printf 'expected=%s\nactual=%s\n' "$OT65_BASE" "$POST_FETCH_HEAD" >&2
      exit 65
    fi

Verify the approved base branch itself has not advanced or diverged:

    REMOTE_BASE_REF="refs/remotes/origin/$OT65_BASE_BRANCH"
    git show-ref --verify --quiet "$REMOTE_BASE_REF" || {
      printf 'BLOCKED_APPROVED_BASE_BRANCH_NOT_FOUND\n' >&2
      exit 65
    }

    REMOTE_BASE_SHA="$(git rev-parse "$REMOTE_BASE_REF")"
    if [ "$REMOTE_BASE_SHA" != "$OT65_BASE" ]; then
      printf 'BLOCKED_APPROVED_BASE_BRANCH_SHA_MISMATCH\n' >&2
      printf 'expected=%s\nactual=%s\n' "$OT65_BASE" "$REMOTE_BASE_SHA" >&2
      exit 65
    fi

Verify that all accepted values resolve to immutable commit objects:

    for sha in \
      "$OT65_ACCEPTED_OT60" \
      "$OT65_ACCEPTED_OT46" \
      "$OT65_ACCEPTED_OT52" \
      "$OT65_BASE"; do
      git cat-file -e "${sha}^{commit}" || {
        printf 'BLOCKED_MISSING_COMMIT=%s\n' "$sha" >&2
        exit 65
      }
    done

The director-approved base must contain the exact accepted OT-60, OT-46, and OT-52
commits:

    for sha in \
      "$OT65_ACCEPTED_OT60" \
      "$OT65_ACCEPTED_OT46" \
      "$OT65_ACCEPTED_OT52"; do
      git merge-base --is-ancestor "$sha" "$OT65_BASE" || {
        printf 'BLOCKED_ACCEPTED_COMMIT_NOT_CONTAINED=%s\n' "$sha" >&2
        exit 65
      }
    done

The accepted OT-60 commit must itself contain the accepted OT-46 and OT-52
foundations:

    git merge-base --is-ancestor "$OT65_ACCEPTED_OT46" "$OT65_ACCEPTED_OT60" || {
      printf 'BLOCKED_OT60_DOES_NOT_CONTAIN_OT46\n' >&2
      exit 65
    }

    git merge-base --is-ancestor "$OT65_ACCEPTED_OT52" "$OT65_ACCEPTED_OT60" || {
      printf 'BLOCKED_OT60_DOES_NOT_CONTAIN_OT52\n' >&2
      exit 65
    }

Print only immutable commit metadata:

    git show --no-patch --format='%H %P %cI %s' \
      "$OT65_ACCEPTED_OT46" \
      "$OT65_ACCEPTED_OT52" \
      "$OT65_ACCEPTED_OT60" \
      "$OT65_BASE"

Do not print commit diffs containing credentials, customer data, or production
configuration.

===============================================================================
3. PHASE 0C — ACCEPTANCE EVIDENCE, LOCAL INSTRUCTIONS, AND COLLISION AUDIT
===============================================================================

Before any branch or worktree is created, inspect all repository instructions at the
approved base:

    mapfile -t AGENT_FILES < <(
      git ls-tree -r --name-only "$OT65_BASE" |
      grep -E '(^|/)AGENTS\.md$' |
      sort
    )

    if [ "${#AGENT_FILES[@]}" -eq 0 ]; then
      printf 'BLOCKED_AGENTS_INSTRUCTIONS_NOT_FOUND\n' >&2
      exit 66
    fi

    for path in "${AGENT_FILES[@]}"; do
      printf '\n===== %s =====\n' "$path"
      git show "$OT65_BASE:$path"
    done

All applicable `AGENTS.md` instructions are binding. A deeper file controls its
subtree. If an instruction conflicts with this prompt, choose the safer behavior and
record the conflict as a blocker rather than weakening either rule.

Prove the accepted evidence exists. Do not rely only on PR titles or branch names:

    git ls-tree -r --name-only "$OT65_ACCEPTED_OT46" |
      grep -E '^ops/evidence/ot-46/' >/dev/null || {
        printf 'BLOCKED_OT46_EVIDENCE_MISSING\n' >&2
        exit 66
      }

    git ls-tree -r --name-only "$OT65_ACCEPTED_OT52" |
      grep -E '^ops/evidence/ot-52/' >/dev/null || {
        printf 'BLOCKED_OT52_EVIDENCE_MISSING\n' >&2
        exit 66
      }

    git ls-tree -r --name-only "$OT65_ACCEPTED_OT60" |
      grep -E '^ops/evidence/ot-60/' >/dev/null || {
        printf 'BLOCKED_OT60_EVIDENCE_MISSING\n' >&2
        exit 66
      }

Read every final report, integration manifest, collision manifest, migration manifest,
changed-file manifest, and acceptance record found under those three evidence
directories. At minimum, search for:

    git grep -n -I -E \
      'FINAL|ACCEPT|INTEGRATION|COLLISION|MIGRATION|CHECKSUM|OWNERSHIP|AUTH|SESSION|CSRF|HOUSEHOLD|PARENT|BILLING|STRIPE|ENTITLEMENT|SUPPORT' \
      "$OT65_ACCEPTED_OT46" -- ops/evidence/ot-46

    git grep -n -I -E \
      'FINAL|ACCEPT|INTEGRATION|COLLISION|MIGRATION|CHECKSUM|OWNERSHIP|AUTH|SESSION|CSRF|HOUSEHOLD|PARENT|BILLING|ENTITLEMENT|SUPPORT' \
      "$OT65_ACCEPTED_OT52" -- ops/evidence/ot-52

    git grep -n -I -E \
      'FINAL|ACCEPT|INTEGRATION|COLLISION|MIGRATION|CHECKSUM|OWNERSHIP|AUTH|SESSION|CSRF|HOUSEHOLD|PARENT|BILLING|STRIPE|ENTITLEMENT|SUPPORT' \
      "$OT65_ACCEPTED_OT60" -- ops/evidence/ot-60

Stop if:

- an accepted report calls the work provisional, isolated, unmounted, fixture-only,
  blocked, evidence-only, not accepted, not integrated, or not merge-authorized;
- OT-60 does not record a reconciliation decision for overlapping OT-46 and OT-52
  files;
- the accepted commits disagree about migration ownership, auth/session conventions,
  parent relationships, billing subjects, webhook ingress, portal routing,
  entitlements, or support-ticket ownership;
- an accepted SHA was supplied for a draft or provisional branch rather than an
  accepted result;
- a migration checksum in Git does not match the accepted evidence;
- accepted evidence relies on a production database, live Stripe object, real charge,
  or BNA mutation.

Inventory all open pull requests and exact changed paths. Use GitHub metadata rather
than assuming a branch is inactive:

    if command -v gh >/dev/null 2>&1; then
      gh pr list \
        --repo webcraft-media/onetimev2 \
        --state open \
        --limit 200 \
        --json number,title,isDraft,headRefName,headRefOid,baseRefName,url
    else
      printf 'BLOCKED_GITHUB_CLI_REQUIRED_FOR_COLLISION_AUDIT\n' >&2
      exit 66
    fi

For every open PR, retrieve its changed filenames with the GitHub API and compare them
against:

- billing migrations;
- billing contracts and domain code;
- Stripe adapter paths;
- webhook ingress;
- worker composition;
- parent portal routes and UI;
- parent API clients;
- household/guardian relationships;
- entitlement projection and class/library authorization;
- central app composition;
- package and lock files.

A simple safe loop is:

    mkdir -p "${TMPDIR:-/tmp}/ot65-pr-audit"
    gh pr list \
      --repo webcraft-media/onetimev2 \
      --state open \
      --limit 200 \
      --json number \
      --jq '.[].number' |
    while read -r pr; do
      gh api \
        --paginate \
        "repos/webcraft-media/onetimev2/pulls/$pr/files?per_page=100" \
        --jq '.[].filename' \
        >"${TMPDIR:-/tmp}/ot65-pr-audit/pr-${pr}-files.txt"
    done

Temporary collision files must contain filenames only and must be deleted after the
audit. Do not use `git clean`.

Stop before creating a worktree if another unaccepted branch owns any of the same
billing migration, route, webhook, gateway, parent-billing UI, worker, or entitlement
paths and OT-60 contains no explicit reconciliation decision.

===============================================================================
4. PHASE 0D — MIGRATION LEDGER AND ARCHITECTURE-CONVENTION READBACK
===============================================================================

At the approved base, inventory migrations without assuming the next identifier:

    git ls-tree -r --name-only "$OT65_BASE" packages/db/migrations |
      grep '\.sql$' |
      sort

Read the exact migration runner and ledger implementation:

- `scripts/migrate.ts`
- `packages/db/src/index.ts`
- any migration helpers introduced by accepted OT-60.

The preliminary audit found that the earlier repository used:

- forward-only SQL files under `packages/db/migrations`;
- `npm run db:migrate`;
- `npm run db:verify`;
- a checksummed `onetime.schema_migrations` ledger;
- `pg_advisory_xact_lock(81227001)` around migration application.

That preliminary state is not authority for a later accepted base. Verify it again.
If the accepted base uses a different ledger, checksum algorithm, lock, directory, or
migration naming rule than its accepted OT-60 evidence describes, stop.

Derive the OT-65 migration identifier from the integrated accepted ledger and all
recorded namespace reservations. Never assume `1301`, never reuse a missing number,
and never edit an existing migration. Record:

- every existing migration filename;
- every checksum;
- every reserved namespace;
- every open-PR migration collision;
- the exact chosen OT-65 migration filename;
- the reason it is the next lawful identifier.

Do not create the migration yet.

Read and compare the accepted conventions for:

- authentication and session resolution;
- session-security-version enforcement;
- CSRF proof requirements;
- capability naming;
- account/product scoping;
- parent-to-household relationship authorization;
- safe denial envelopes;
- private/no-store responses;
- API versioning and screen-oriented endpoints;
- route registration order;
- raw-body middleware;
- rate limiting;
- audit events;
- error envelopes;
- optimistic concurrency;
- worker leases;
- support-ticket creation;
- parent shell and route-chunk loading;
- class/library entitlement checks.

Stop if accepted code and accepted evidence differ. Do not reconcile an undocumented
difference by guesswork.

===============================================================================
5. PHASE 0E — READ-ONLY STRIPE TEST-ACCOUNT OWNERSHIP PROOF
===============================================================================

This is a read-only external proof. It must complete before any source edit. It may
retrieve only the approved test account, product, price, and customer-portal
configuration. It must not create, update, archive, delete, activate, or configure a
Stripe object.

Required protected environment variable:

- `ONE_TIME_BILLING_STRIPE_SECRET_KEY`

Do not echo it. Do not pass it on a command line. Do not store it in a file. Do not
run with shell tracing.

Reject the environment before making any request:

    case "${ONE_TIME_BILLING_STRIPE_SECRET_KEY:-}" in
      sk_test_*) ;;
      '')
        printf 'BLOCKED_TEST_STRIPE_KEY_NOT_CONFIGURED\n' >&2
        exit 67
        ;;
      *)
        printf 'BLOCKED_NON_TEST_STRIPE_KEY\n' >&2
        exit 67
        ;;
    esac

Use Node.js 24 built-in `fetch` from stdin so the credential remains in the process
environment rather than command arguments. Export only the nonsecret approved values
needed by this read-only proof.

The script must:

1. GET `/v1/account`.
2. GET the exact approved Product.
3. GET the exact approved Price.
4. GET the exact approved Billing Portal Configuration.
5. Verify all responses are from the expected account and are test-mode objects.
6. Print only booleans, commercial fields, and truncated SHA-256 fingerprints.
7. Never print response bodies, object descriptions, customer fields, emails,
   addresses, metadata, credentials, or full object IDs.
8. Exit nonzero on any mismatch.

Use this structure:

    export OT65_STRIPE_ACCOUNT OT65_STRIPE_PRODUCT OT65_STRIPE_PRICE
    export OT65_STRIPE_PORTAL_CONFIG OT65_STRIPE_API_VERSION
    export OT65_CURRENCY OT65_AMOUNT_MINOR OT65_COMMERCIAL_JSON OT65_TAX_POLICY

    node --input-type=module <<'NODE'
    import { createHash } from 'node:crypto';

    const key = process.env.ONE_TIME_BILLING_STRIPE_SECRET_KEY ?? '';
    if (!key.startsWith('sk_test_') || key.includes('_live_')) {
      throw new Error('BLOCKED_NON_TEST_STRIPE_KEY');
    }

    const expected = {
      account: process.env.OT65_STRIPE_ACCOUNT,
      product: process.env.OT65_STRIPE_PRODUCT,
      price: process.env.OT65_STRIPE_PRICE,
      portal: process.env.OT65_STRIPE_PORTAL_CONFIG,
      apiVersion: process.env.OT65_STRIPE_API_VERSION,
      currency: process.env.OT65_CURRENCY,
      amount: Number(process.env.OT65_AMOUNT_MINOR),
      commercial: JSON.parse(process.env.OT65_COMMERCIAL_JSON),
      tax: JSON.parse(process.env.OT65_TAX_POLICY),
    };

    const fingerprint = (value) =>
      createHash('sha256').update(String(value)).digest('hex').slice(0, 16);

    async function stripeGet(path) {
      const response = await fetch(`https://api.stripe.com${path}`, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${key}`,
          'stripe-version': expected.apiVersion,
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`BLOCKED_STRIPE_READ_STATUS_${response.status}`);
      }
      return response.json();
    }

    const [account, product, price, portal] = await Promise.all([
      stripeGet('/v1/account'),
      stripeGet(`/v1/products/${encodeURIComponent(expected.product)}`),
      stripeGet(`/v1/prices/${encodeURIComponent(expected.price)}`),
      stripeGet(
        `/v1/billing_portal/configurations/${encodeURIComponent(expected.portal)}`,
      ),
    ]);

    if (account.id !== expected.account) {
      throw new Error('BLOCKED_STRIPE_ACCOUNT_MISMATCH');
    }
    if (product.id !== expected.product || product.livemode !== false || !product.active) {
      throw new Error('BLOCKED_STRIPE_PRODUCT_MISMATCH');
    }
    if (price.id !== expected.price || price.livemode !== false || !price.active) {
      throw new Error('BLOCKED_STRIPE_PRICE_MISMATCH');
    }
    if (
      (typeof price.product === 'string' ? price.product : price.product?.id) !==
      expected.product
    ) {
      throw new Error('BLOCKED_STRIPE_PRICE_PRODUCT_MISMATCH');
    }
    if (price.type !== 'recurring' || !price.recurring) {
      throw new Error('BLOCKED_STRIPE_PRICE_NOT_RECURRING');
    }
    if (price.currency !== expected.currency) {
      throw new Error('BLOCKED_STRIPE_CURRENCY_MISMATCH');
    }
    if (price.unit_amount !== expected.amount) {
      throw new Error('BLOCKED_STRIPE_AMOUNT_MISMATCH');
    }
    if (price.recurring.interval !== expected.commercial.recurring_interval) {
      throw new Error('BLOCKED_STRIPE_INTERVAL_MISMATCH');
    }
    if (
      price.recurring.interval_count !==
      expected.commercial.recurring_interval_count
    ) {
      throw new Error('BLOCKED_STRIPE_INTERVAL_COUNT_MISMATCH');
    }
    if (portal.id !== expected.portal || portal.livemode !== false || !portal.active) {
      throw new Error('BLOCKED_STRIPE_PORTAL_CONFIGURATION_MISMATCH');
    }

    const approvedTaxBehavior = expected.tax.price_tax_behavior;
    if (
      approvedTaxBehavior &&
      price.tax_behavior !== approvedTaxBehavior
    ) {
      throw new Error('BLOCKED_STRIPE_PRICE_TAX_BEHAVIOR_MISMATCH');
    }

    process.stdout.write(
      JSON.stringify(
        {
          stripe_mode: 'test',
          account_verified: true,
          product_verified: true,
          price_verified: true,
          portal_configuration_verified: true,
          account_fingerprint: fingerprint(account.id),
          product_fingerprint: fingerprint(product.id),
          price_fingerprint: fingerprint(price.id),
          portal_configuration_fingerprint: fingerprint(portal.id),
          currency: price.currency,
          amount_minor_units: price.unit_amount,
          recurring_interval: price.recurring.interval,
          recurring_interval_count: price.recurring.interval_count,
          tax_behavior: price.tax_behavior,
        },
        null,
        2,
      ) + '\n',
    );
    NODE

Do not redirect the script’s output into the repository at this stage.

Manually compare the retrieved portal features with
`portal_allowed_actions`, `{{APPROVED_CANCELLATION_POLICY}}`, and all plan-change
rules. The default portal configuration is not acceptable merely because Stripe has
one. The exact approved configuration ID must be used.

Stop if:

- account ownership cannot be proven;
- the key is missing or is not a test key;
- the account, product, price, or portal configuration differs;
- Product, Price, or Portal Configuration is inactive;
- any object is live mode;
- amount, currency, recurring interval, interval count, product binding, or tax
  behavior differs;
- the portal permits an unapproved cancellation, resumption, plan-change, coupon, or
  payment-method action;
- the test-mode environment is the account’s shared test-mode sandbox and a required
  Dashboard setting would also affect live mode;
- proving readiness would require modifying the account, Product, Price, coupon,
  promotion code, tax setting, portal configuration, or webhook endpoint.

Unset the credential from the interactive environment after the proof if it is no
longer needed:

    unset ONE_TIME_BILLING_STRIPE_SECRET_KEY

===============================================================================
6. PRELIMINARY READ-ONLY AUDIT SNAPSHOT — NOT AN ACCEPTANCE SUBSTITUTE
===============================================================================

This snapshot records what was found on July 14, 2026 while preparing this prompt.
Execution must re-audit the exact accepted values and must not substitute these
candidate SHAs for the unresolved accepted placeholders.

Repository state found during prompt preparation:

- The accessible default branch was not a converged OT-60 result.
- PR 12, “OT-46P isolated Stripe fixture-only foundation,” was an open, unmerged,
  draft PR.
- Its candidate head was
  `f4e4fb1dc202f8b17bbf1747c82ae3b0c1c5c899`.
- Its construction base was
  `a73458d1884b8fcb4843c4852425009577f59ef7`.
- Its own report said central integration and real PostgreSQL proof remained pending.
- No submitted review had accepted it.
  
- No OT-52 Parent Portal or OT-60 convergence PR, issue, branch, or accepted commit
  was found in the accessible graph at that time.
- Therefore none of the preliminary candidate SHAs is authorization to execute
  OT-65.

The OT-46 candidate added:

- `packages/contracts/src/billing/index.ts`
- `packages/domain/src/billing/**`
- `packages/db/src/billing/repository.ts`
- `packages/db/migrations/1300_ot46_billing_foundation.sql`
- `apps/web/src/server/features/billing/router.ts`
- an unmounted reference UI under
  `apps/web/src/client/features/billing/`
- focused tests and evidence under `ops/evidence/ot-46/`.

Its candidate migration checksum was:

`DBF2F4F6152985496906455561FBD7D6F9032DC91044B4A746A3CF5396427738`

Its integration manifest explicitly left app composition, root packages, package
barrels, workflows, and existing migrations untouched and required later central
integration. 

The preliminary repository instructions identified:

- Node.js 24;
- TypeScript;
- Express 5;
- Vite;
- PostgreSQL through `pg`;
- parameterized SQL;
- forward-only checksummed migrations;
- separate public and authenticated bundles;
- no BNA session, cookie, runtime, source, shell, secret, or broad migration reuse;
- black/yellow One Time design;
- server-derived account/product scope.
  

The candidate migration created test-only provider, offer, customer, checkout,
subscription, invoice, event, reconciliation, entitlement, and audit records.


The following candidate behaviors are provisional and must not be promoted unchanged:

- `principal_key` and `principal_type` are not the accepted parent/household billing
  subject model.
- several records use text account/product/principal keys rather than proven foreign
  keys to the accepted canonical domain;
- `billing_checkout_sessions.redirect_url` persists a hosted redirect URL;
- API contracts expose provider session and invoice references;
- the fixture webhook uses `x-fixture-billing-signature`;
- webhook processing is synchronous after inbox insertion;
- the event inbox lacks a complete durable claim/lease/retry/dead-letter state;
- local checkout idempotency is checked before the provider call but is not durably
  reserved before that call, leaving a concurrency seam;
- customer mappings can be updated to a different provider customer reference;
- event insert follows a read-then-insert sequence that needs real PostgreSQL
  concurrency proof;
- stale projection handling relies primarily on provider event time;
- missing invoice fields can become zero/default values;
- invoice summaries can expose provider references through DTOs;
- entitlement projections are intentionally constrained to `grants_access=false`;
- there is no accepted subscription-item, refund, dispute, parent relationship,
  class/library benefit, or support-ticket integration;
- the reference Billing panel exposes raw internal status vocabulary and generic
  “Checkout” and “Portal” actions;
- the candidate was not mounted into central app composition.

OT-65 must reconcile these seams additively. It must not edit the accepted OT-46
migration or create a second billing runtime.

===============================================================================
7. CREATE THE DEDICATED WORKTREE AND BRANCH
===============================================================================

Only after every Phase 0 gate passes may you create the worktree.

Use:

    cd "$REPO_ROOT"

    OT65_BRANCH='codex/ot65-stripe-parent-billing-test-mode'
    OT65_WORKTREE="$(dirname "$REPO_ROOT")/onetimev2-ot65-stripe-parent-billing"

    if git show-ref --verify --quiet "refs/heads/$OT65_BRANCH"; then
      printf 'BLOCKED_OT65_LOCAL_BRANCH_ALREADY_EXISTS\n' >&2
      exit 68
    fi

    if git ls-remote --exit-code --heads origin "$OT65_BRANCH" >/dev/null 2>&1; then
      printf 'BLOCKED_OT65_REMOTE_BRANCH_ALREADY_EXISTS\n' >&2
      exit 68
    fi

    if [ -e "$OT65_WORKTREE" ]; then
      printf 'BLOCKED_OT65_WORKTREE_PATH_ALREADY_EXISTS\n' >&2
      exit 68
    fi

    git worktree add -b "$OT65_BRANCH" "$OT65_WORKTREE" "$OT65_BASE"
    cd "$OT65_WORKTREE"

    test "$(git rev-parse HEAD)" = "$OT65_BASE"
    test "$(git branch --show-current)" = "$OT65_BRANCH"
    test -z "$(git status --porcelain=v1 --untracked-files=all)"

Do not reuse, reset, clean, overwrite, or repurpose another worktree. Do not detach
and then move an existing branch. Do not modify the source worktree.

Read all applicable instructions again from the new worktree:

    git ls-files |
      grep -E '(^|/)AGENTS\.md$' |
      sort |
    while read -r path; do
      printf '\n===== %s =====\n' "$path"
      cat "$path"
    done

Create `ops/evidence/ot-65/` only after this point.

===============================================================================
8. PRE-EDIT BASELINE AND AUDIT EVIDENCE
===============================================================================

Before product changes:

1. Create sanitized evidence files:

   - `ops/evidence/ot-65/PREFLIGHT.md`
   - `ops/evidence/ot-65/ACCEPTED-HEADS-AND-CONTAINMENT.md`
   - `ops/evidence/ot-65/INSTRUCTION-READBACK.md`
   - `ops/evidence/ot-65/COLLISION-AND-OWNERSHIP.md`
   - `ops/evidence/ot-65/MIGRATION-LEDGER-BEFORE.md`
   - `ops/evidence/ot-65/ARCHITECTURE-AUDIT.md`
   - `ops/evidence/ot-65/COMMERCIAL-DECISIONS.md`
   - `ops/evidence/ot-65/STRIPE-DOCS-VERIFICATION.md`
   - `ops/evidence/ot-65/STRIPE-TEST-OBJECT-PROOF.md`

2. Include exact accepted SHAs and safe fingerprints, but never credentials or full
   Stripe payloads.

3. Record the chosen migration identifier but do not create the migration until
   schema ownership is settled.

4. Run baseline installation and checks:

       npm ci

       test -z "$(git status --porcelain=v1 --untracked-files=all)" || {
         printf 'BLOCKED_NPM_CI_CHANGED_TRACKED_STATE\n' >&2
         git status --short >&2
         exit 69
       }

       npm run secret:scan
       npm run lint
       npm run typecheck
       npm run unit
       npm run integration
       npm run build

5. Run `npm run format` and record the exact baseline result. Do not run
   `npm run format:write` over the repository.

6. Run `npm run verify` if the accepted base supports it.

A pre-existing failure may be carried only when:

- it reproduces at the exact accepted base;
- accepted OT-60 evidence explicitly records it as a non-OT-65 baseline exception;
- no OT-65-owned file is implicated;
- no security, migration, auth, billing, entitlement, accessibility, or bundle gate
  is affected.

Otherwise stop.

===============================================================================
9. ROLE AND MISSION
===============================================================================

You are the senior engineer responsible for Stripe subscription billing,
authorization integrity, asynchronous reconciliation, data integrity, security, and
the relationship-scoped Parent Billing experience for standalone One Time.

Your mission is to implement OT-65 on the exact approved converged base. You must
integrate the accepted OT-46 Stripe foundation and accepted OT-52 Parent Portal through
the accepted OT-60 convergence result. You must not create a second:

- auth or session system;
- parent portal shell;
- parent/household relationship model;
- billing domain;
- Stripe gateway;
- webhook ingress;
- worker runtime;
- invoice projection;
- entitlement system;
- support-ticket system;
- class/library authorization path;
- migration ledger.

Stripe is billing infrastructure only. It is never identity or authentication.

A successful Checkout, hosted return, portal session, invoice email, PaymentIntent,
Customer object, or matching email address must never:

- create a One Time login session;
- establish parent authority;
- select a household;
- establish a guardian/learner relationship;
- create a canonical person or contact;
- grant class or library access;
- grant owner/admin capability;
- bypass session-security-version checks.

Every provider object must correlate server-side to immutable internal account,
product, billing-subject, household, plan, and checkout-attempt identifiers. Email is
never an authority key.

===============================================================================
10. THREE DISTINCT GATES
===============================================================================

Keep these gates separate in code, evidence, configuration, and final reporting.

Gate R — Repository implementation

- schema, domain, gateway, routes, worker, parent UI, fixtures, tests, and rollback
  controls implemented;
- ordinary tests use fake adapters only;
- real disposable PostgreSQL proof complete;
- no Stripe network call is required to pass ordinary CI.

Gate S — Stripe test-mode staging canary

- requires separate successful Gate R;
- uses only the approved test account, Product, Price, portal configuration, webhook
  endpoint, staging origin, and staging target;
- permits only the controlled test objects produced by one approved canary journey;
- must remain reversible;
- must record safe fingerprints and object counts.

Gate L — live activation

- expressly outside OT-65;
- always unauthorized;
- no live credential, object, endpoint, Product, Price, Checkout, portal session,
  charge, entitlement, deployment, or data mutation;
- `LIVE_STRIPE_CHARGES_AUTHORIZED=NO`.

Passing Gate R does not imply Gate S. Passing Gate S does not imply Gate L.

===============================================================================
11. FILE OWNERSHIP
===============================================================================

Derive exact accepted paths before editing. Use this table as the maximum ownership
envelope.

Allowed, subject to accepted-base verification:

| Path | Allowed OT-65 purpose |
| --- | --- |
| `packages/contracts/src/billing/**` | Reconcile and extend accepted billing contracts |
| `packages/domain/src/billing/**` | Commercial config, policies, gateway interfaces, projection logic |
| `packages/db/src/billing/**` | Billing repositories, transactions, leases, reconciliation |
| `packages/db/migrations/<derived-ot65-id>_ot65_stripe_parent_billing.sql` | One additive forward-only migration |
| `apps/web/src/server/features/billing/**` | Canonical billing routes and Stripe webhook ingress |
| accepted OT-52 parent API/UI paths | Smallest complete Billing subsection |
| `apps/web/src/client/features/billing/**` | Billing-specific UI components and client adapter |
| `apps/web/src/server/app.ts` | Minimal raw-body order and canonical router registration only |
| `apps/web/src/server/index.ts` | Minimal accepted dependency wiring only |
| `apps/worker/src/billing/**` | Billing inbox/reconciliation worker code |
| `apps/worker/src/main/index.ts` | Minimal registration with the accepted worker composition |
| `packages/config/src/index.ts` | Allowlisted, fail-closed billing configuration |
| accepted package barrel files | Only when accepted OT-60 already uses barrel exports |
| `package.json` and lockfile | Exact Stripe SDK pin and focused scripts only |
| `scripts/secret-scan.mjs` | Add missing Stripe/webhook credential patterns |
| `scripts/check-bundles.ts` | Add server/client and public/auth billing separation checks |
| `tests/unit/**ot65**` | Unit tests |
| `tests/integration/**ot65**` | Integration and real PostgreSQL tests |
| `tests/e2e/**ot65**` | Parent browser journeys |
| `tests/accessibility/**ot65**` | Accessibility and keyboard tests |
| `tests/performance/**ot65**` | Performance, bundle, and reflow tests |
| `tests/helpers/**ot65**` | Deterministic fixtures and network-deny helper |
| `ops/evidence/ot-65/**` | Sanitized OT-65 evidence |

Conditionally allowed only with an explicit collision decision:

- accepted OT-52 parent navigation registry;
- accepted OT-60 capability registry;
- accepted class/library entitlement middleware;
- accepted support-ticket request schema;
- a CI workflow, but only if ordinary CI otherwise cannot enforce the hard Stripe
  network deny.

Forbidden:

- BNA repositories, source, database, sessions, cookies, routes, assets, provider
  runtime, shell, Operations, Studio, agents, memory, and secrets;
- public landing and signup implementation;
- lead-capture behavior;
- unrelated CRM behavior;
- Telegram, email, WhatsApp, delivery-worker, and content-library implementation
  outside a minimal accepted entitlement adapter;
- existing migrations, including the accepted OT-46 migration;
- production or Railway configuration;
- DNS;
- generated `dist`;
- `node_modules`;
- `.env` or credential files;
- screenshots containing real data;
- broad formatting changes;
- unrelated package upgrades;
- live Stripe support;
- a second webhook route, billing router, parent shell, or entitlement projector.

Before editing any path not listed above, stop and record
`BLOCKED_FILE_OWNERSHIP_EXPANSION_REQUIRED`.

===============================================================================
12. OFFICIAL STRIPE DOCUMENTATION RE-VERIFICATION
===============================================================================

Re-verify current official Stripe documentation at execution time. Use official
Stripe documentation, the official Stripe Node SDK repository/package metadata, and
no third-party tutorial as authority.

At minimum re-verify:

- Checkout Session creation:
  `https://docs.stripe.com/api/checkout/sessions/create`
- Customer Portal Session creation:
  `https://docs.stripe.com/api/customer_portal/sessions/create`
- webhook registration, raw body, retries, ordering, duplicates, API version, replay
  protection, and quick `2xx`:
  `https://docs.stripe.com/webhooks`
- signature troubleshooting:
  `https://docs.stripe.com/webhooks/signature`
- idempotent requests:
  `https://docs.stripe.com/api/idempotent_requests`
- metadata:
  `https://docs.stripe.com/api/metadata`
- sandbox/test-mode behavior:
  `https://docs.stripe.com/testing-use-cases`
- subscription webhooks:
  `https://docs.stripe.com/billing/subscriptions/webhooks`
- cancellation:
  `https://docs.stripe.com/billing/subscriptions/cancel`
- trials:
  `https://docs.stripe.com/billing/subscriptions/trials`
- refunds:
  `https://docs.stripe.com/refunds`
- disputes:
  `https://docs.stripe.com/disputes`

The July 14, 2026 documentation review established the following items that must be
re-verified rather than assumed:

- Checkout supports server-selected Prices, subscription mode, customer binding,
  success/cancel URLs, `client_reference_id`, and metadata. Tax behavior and minor
  units must match the approved Price. :contentReference[oaicite:5]{index=5}
- Portal sessions require a Customer and produce a hosted URL; an exact configuration
  can constrain enabled actions. :contentReference[oaicite:6]{index=6}
- Stripe requires raw request bytes and the `Stripe-Signature` header for signature
  verification; Express JSON parsing must run after the webhook route.
  :contentReference[oaicite:7]{index=7}
- events can be duplicated and delivered out of order; asynchronous processing and a
  quick `2xx` are recommended; the default replay tolerance is five minutes and
  must not be disabled. :contentReference[oaicite:8]{index=8}
- POST idempotency results, including some errors, can be replayed; keys can be
  pruned after at least 24 hours, so local durable idempotency must outlive provider
  retention and must reject parameter-hash mismatches. :contentReference[oaicite:9]{index=9}
- sandbox objects are isolated from live objects, but the built-in test-mode sandbox
  can share some Dashboard settings with live mode. No Dashboard setting may be
  changed unless it is proven isolated. :contentReference[oaicite:10]{index=10}
- subscription state changes are asynchronous; an `invoice.paid` event is not enough
  by itself unless the subscription and approved internal policy also support access.
  :contentReference[oaicite:11]{index=11}
- a scheduled period-end cancellation can be resumed before period end, while a
  fully canceled subscription cannot simply be reactivated.
  :contentReference[oaicite:12]{index=12}
- refunds can be pending, failed, canceled, or require action, and a dispute can
  overlap with a refund. :contentReference[oaicite:13]{index=13}
- current Trial Offer APIs can require preview behavior and are not supported through
  Checkout; Checkout-based trials use a different mechanism. Do not select either
  without the approved policy. :contentReference[oaicite:14]{index=14}

Record in `STRIPE-DOCS-VERIFICATION.md`:

- verification date and timezone;
- exact Stripe Node SDK version selected;
- exact API version;
- exact webhook endpoint API version;
- exact request fields used;
- exact event allowlist;
- any current documentation behavior that differs from this prompt;
- whether any required feature is preview-only.

If a required behavior is preview-only and the approved decisions do not explicitly
authorize that preview, stop.

Pin the official Stripe Node SDK exactly. Do not use a floating range. If the accepted
base has no Stripe SDK, run only after Phase 0:

    npm view stripe version
    npm install --save-exact stripe@<verified-exact-version>

Inspect the package diff. No other dependency may change unintentionally.

===============================================================================
13. CANONICAL BILLING DOMAIN AND ADDITIVE MIGRATION
===============================================================================

Reconcile the accepted OT-46 records with accepted OT-52/OT-60 domain objects. Do not
blindly reproduce table names below when an accepted canonical record already exists.

The completed model must minimally cover:

1. Internal billing subject

   - immutable internal ID;
   - account and product foreign keys;
   - canonical household or approved billing-subject foreign key;
   - active/archive state;
   - optimistic version;
   - timestamps;
   - one active canonical subject per approved scope where product policy requires
     one.

2. Stripe account binding

   - provider `stripe`;
   - mode `test`;
   - exact account binding;
   - nonsecret account fingerprint;
   - status and verification timestamp;
   - no credential storage.

3. Product, Price, plan, tier, and benefit mapping

   - internal plan and tier IDs;
   - exact Stripe Product and Price IDs, server-only;
   - currency;
   - amount in generic minor units, not an assumed “cents” concept;
   - recurring interval and count;
   - quantity;
   - tax behavior;
   - benefit-set version;
   - immutable commercial-config version;
   - active/archive status;
   - foreign keys and uniqueness.

4. Stripe Customer mapping

   - billing-subject ID;
   - account/product scope;
   - provider account and mode;
   - server-only Customer ID;
   - active/archive/manual-review state;
   - verification timestamp and source;
   - one active customer mapping per subject/provider-account/mode;
   - unique provider Customer mapping;
   - no email-based mapping;
   - no silent overwrite of a different Customer ID.

5. Checkout attempt and operation idempotency

   - internal attempt ID and random public action reference;
   - billing subject, plan, and policy version;
   - canonical request hash;
   - local idempotency key;
   - stable Stripe idempotency key or its protected value;
   - states such as reserved, provider_pending, created, returned, completed, expired,
     failed, ambiguous, and manual_review;
   - provider Checkout Session ID server-side only;
   - expiration and retry timestamps;
   - version and audit fields;
   - no persisted hosted Checkout URL;
   - reservation committed before the provider call;
   - conflicting reuse of a key with a different request hash rejected;
   - concurrency-safe prevention of duplicate active subscriptions and duplicate
     Checkout sessions.

6. Subscription and subscription-item projections

   - billing subject and customer mapping;
   - provider subscription and item IDs server-side only;
   - plan/Price binding;
   - status;
   - collection method;
   - trial start/end when applicable;
   - current period dates using the fields dictated by the pinned API version;
   - cancel-at-period-end, cancel-at, canceled-at, ended-at;
   - pause/resume state when policy permits;
   - latest source event and reconciliation generation;
   - object-state digest;
   - monotonic update controls that do not rely only on event delivery order.

7. Webhook inbox

   - unique provider account/mode/event ID;
   - event type;
   - provider-created timestamp;
   - endpoint API version;
   - object type and ID server-side;
   - raw-body digest and sanitized-payload digest;
   - minimal sanitized envelope only;
   - received timestamp;
   - states such as accepted, queued, processing, applied, ignored, retryable,
     dead_letter, and manual_review;
   - attempt count and next-attempt timestamp;
   - lease owner, token, generation, and expiry;
   - last safe error class;
   - applied timestamp;
   - unique event identity and semantic duplicate handling;
   - no raw body, signature, full payload, email, address, payment data, or secret.

8. Processing-attempt history

   - append-only;
   - event reference;
   - generation;
   - disposition;
   - safe reason code;
   - timestamps;
   - no provider payload.

9. Invoice and receipt projection

   - internal random public invoice reference;
   - billing subject and subscription;
   - status, currency, amount due/paid/remaining, period, and issue date;
   - truthful receipt/invoice availability;
   - provider invoice and payment references server-side only;
   - no persisted hosted invoice or PDF URL;
   - no default currency or zero amount when Stripe omitted a required field;
   - missing or contradictory fields cause stale/manual-review state.

10. Refund projection

    - provider refund reference server-side;
    - related payment/invoice/subscription;
    - amount and currency;
    - status including pending, requires_action, succeeded, failed, and canceled where
      current Stripe semantics support them;
    - source event and timestamps;
    - no automatic access conclusion unless approved policy says so.

11. Dispute projection

    - provider dispute reference server-side;
    - related payment/invoice/subscription;
    - current status and safe category;
    - opened/closed timestamps;
    - internal policy result;
    - no evidence payload or cardholder data.

12. Reconciliation cursor and job state

    - subject/object scope;
    - reason;
    - last successful synchronization;
    - next attempt;
    - lease generation;
    - drift state;
    - safe result summary;
    - idempotency and retry exhaustion.

13. Internal entitlement projection and history

    - immutable subject, account, product, plan, tier, and benefit-set references;
    - source category;
    - source effective timestamp;
    - internal effective timestamp;
    - scheduled end;
    - policy version;
    - reconciliation confidence;
    - grants-access boolean;
    - reason code;
    - revision/version;
    - append-only history plus one current projection where accepted architecture
      requires it.

14. Audit events

    - actor/session or system-worker identity;
    - account/product/billing-subject scope;
    - action and target internal IDs;
    - request/trace ID;
    - safe before/after state hashes;
    - policy and configuration version;
    - timestamps;
    - no PII, provider payload, hosted URL, credential, or full Stripe ID in evidence
      output.

Required database constraints:

- foreign keys to accepted account, product, household, parent relationship, plan,
  and benefit records;
- one active canonical Customer mapping where appropriate;
- unique Customer ID within provider account and mode;
- non-cross-mode Product, Price, Customer, Checkout, Subscription, Invoice, Refund,
  Dispute, and Event references;
- unique provider event identity;
- unique local idempotency operation;
- fixed approved quantity;
- lowercase currency;
- amount bounds using appropriate integer types;
- version columns;
- archive constraints;
- provider account/mode scope on every provider-linked record;
- no cross-account, cross-product, or cross-household linkage;
- no destructive cascade that would erase billing, audit, attendance, progress,
  learner, or entitlement history.

All schema changes must be additive and use the exact migration ID derived during
preflight. Do not edit the accepted OT-46 migration.

===============================================================================
14. SERVER-ONLY STRIPE GATEWAY
===============================================================================

Retain the accepted provider abstraction. Replace or extend the fixture-only boundary
with one official Stripe test adapter; do not create a second service layer.

The real Stripe adapter must be server-only and must never enter:

- Vite client bundles;
- serialized HTML;
- public DTOs;
- browser storage;
- logs;
- analytics;
- screenshots;
- evidence;
- test snapshots.

Configuration must be allowlisted and fail closed.

Preserve accepted OT-46 feature flags when compatible:

- `ONE_TIME_BILLING_FOUNDATION_ENABLED`
- `ONE_TIME_BILLING_TRANSPORT_ENABLED`
- `ONE_TIME_BILLING_CHECKOUT_ENABLED`
- `ONE_TIME_BILLING_CUSTOMER_PORTAL_ENABLED`
- `ONE_TIME_BILLING_WEBHOOK_INTAKE_ENABLED`
- `ONE_TIME_BILLING_RECONCILIATION_ENABLED`
- `ONE_TIME_BILLING_MODE`
- `ONE_TIME_BILLING_CANONICAL_PUBLIC_ORIGIN`
- `ONE_TIME_BILLING_EXPECTED_PROVIDER_ACCOUNT_REF`
- the accepted replacement for `ONE_TIME_BILLING_OFFERS_JSON`, if OT-60 retained it.

Add only the protected values genuinely required, following accepted naming
conventions. Expected examples are:

- `ONE_TIME_BILLING_NETWORK_MODE=fixture|stripe_test`
- `ONE_TIME_BILLING_STRIPE_SECRET_KEY`
- `ONE_TIME_BILLING_STRIPE_WEBHOOK_SECRET`
- `ONE_TIME_BILLING_STRIPE_API_VERSION`
- `ONE_TIME_BILLING_STRIPE_ACCOUNT_ID`
- `ONE_TIME_BILLING_STRIPE_PRODUCT_ID`
- `ONE_TIME_BILLING_STRIPE_PRICE_ID`
- `ONE_TIME_BILLING_STRIPE_PORTAL_CONFIGURATION_ID`
- `ONE_TIME_BILLING_STRIPE_WEBHOOK_ENDPOINT_ID`
- `LIVE_STRIPE_CHARGES_AUTHORIZED=NO`

Exact final names must follow accepted OT-60 configuration conventions and must be
listed in the final report. Do not introduce legacy aliases.

At startup:

- default every network and mutation feature off;
- permit only mode `test`;
- reject `sk_live_`, `rk_live_`, live-like mode values, or a truthy live-authorization
  flag;
- reject a missing API version;
- reject account/Product/Price/configuration mismatches;
- expose only a sanitized readiness snapshot with booleans and fingerprints;
- never expose whether a credential exists beyond a generic readiness state;
- never print a secret or full protected configuration value;
- prohibit real adapter construction in ordinary test and CI environments.

Use the official Stripe SDK with:

- an exact pinned package version;
- the exact approved API version;
- bounded timeout;
- bounded network retries;
- stable idempotency keys for every POST;
- application identification;
- safe error classification;
- no automatic fallback to a different API version, account, Product, Price,
  customer, or mode.

Classify errors into:

- validation/policy failure;
- authentication/configuration failure;
- idempotency conflict;
- rate-limited;
- retryable provider failure;
- ambiguous network outcome;
- permanent provider rejection;
- wrong mode/account/object;
- manual review.

An ambiguous write must be retried with the same Stripe idempotency key or reconciled.
Never issue a new key merely because more than 24 hours passed. Escalate to manual
review when provider idempotency retention is no longer sufficient to prove the
outcome.

Never accept these from the browser as authority:

- Stripe Customer, Product, Price, Checkout Session, Subscription, Subscription Item,
  PaymentIntent, Charge, Invoice, Refund, Dispute, portal configuration, coupon, or
  promotion code;
- amount, currency, quantity, tax behavior, recurring interval, trial duration, or
  discount;
- account, product, household, learner, plan, tier, entitlement, success URL, cancel
  URL, return URL, or metadata;
- hosted provider URL;
- a raw provider object.

===============================================================================
15. AUTHORIZATION AND PARENT BILLING SUBJECT
===============================================================================

Use the exact accepted OT-52/OT-60 parent relationship and capability model.

Before implementation, identify and record:

- canonical parent session resolver;
- session-security-version check;
- parent-to-household relationship record;
- household or billing-subject identifier;
- parent billing read capability;
- checkout capability;
- customer-portal capability;
- cancel/resume capability if applicable;
- invoice-read capability;
- support-ticket capability;
- owner/admin scoped capabilities;
- student session and role conventions;
- safe denial envelope.

If any of these is absent or ambiguous, stop. Do not invent a `parent` role or
household table.

Every read and write must:

1. resolve the authenticated session server-side;
2. verify session activity and security version;
3. derive account and product from trusted server context;
4. resolve the selected accepted parent-portal context;
5. prove the parent relationship to the household or billing subject;
6. verify the action-specific capability;
7. reject archived, stale, ambiguous, or cross-scope relationships;
8. return private/no-store output;
9. audit privileged or state-changing operations.

A parent may see only billing for the relationship the server has proved. A parent
must not select or enumerate arbitrary households through a raw ID.

Students must not receive:

- billing summary;
- payment status;
- Checkout controls;
- portal controls;
- invoices or receipts;
- refund/dispute status;
- household billing metadata;
- support context that reveals billing existence.

Unrelated parents, students, wrong-account users, wrong-product users, archived
relationships, and unknown subjects must receive the same generic safe denial. Do not
reveal whether the billing subject exists.

Owner/admin access must still be account/product and capability scoped. It must not
become platform-wide Super Admin access.

===============================================================================
16. SCREEN-ORIENTED PARENT BILLING API
===============================================================================

Use the accepted OT-52 parent API namespace. Do not create a second parent API base.

The resulting API must provide one screen-oriented private/no-store read model and
minimal action endpoints equivalent to:

- `GET <accepted-parent-api-base>/billing`
- `POST <accepted-parent-api-base>/billing/checkout`
- `POST <accepted-parent-api-base>/billing/portal`
- `GET <accepted-parent-api-base>/billing/invoices/:invoicePublicReference/open`
- approved cancel/resume endpoints only if product policy and accepted architecture
  require first-party controls rather than the Stripe portal;
- the accepted support-ticket endpoint.

These names are shape requirements, not permission to duplicate an existing route.
Preserve an accepted canonical route if OT-60 already selected one.

The billing summary DTO may contain only parent-facing values:

- internal screen/version token;
- plan display name;
- tier display name;
- amount, currency, and cadence;
- free-access/trial/current-period dates and display timezone;
- truthful status;
- stale/reconciliation state;
- allowed actions;
- bounded invoice/receipt rows;
- sanitized support context token;
- server-issued, short-lived action tokens bound to actor, session, relationship,
  billing subject, action, policy version, and expiry.

It must not contain:

- full Stripe IDs;
- hosted URLs;
- internal account, product, household, learner, or entitlement database IDs;
- provider payloads;
- webhook state;
- credentials;
- support-provider internals.

Use random internal public references for invoice-opening routes. Reauthorize every
open request, resolve the server-only Stripe Invoice mapping, retrieve the current
hosted invoice or receipt location just in time when necessary, validate it according
to current official Stripe behavior, and issue a private/no-store `303` redirect.
Never persist or return the hosted URL in JSON.

===============================================================================
17. CHECKOUT SESSION CREATION
===============================================================================

Checkout must use Stripe-hosted Checkout in subscription mode unless the approved
decisions explicitly select another current supported mechanism. Do not add Stripe.js
to the parent bundle for hosted Checkout.

The action flow must:

1. accept a server-issued action token and explicit CSRF proof;
2. resolve the parent, relationship, billing subject, plan, Product, Price, account,
   mode, quantity, tax, payment methods, and URLs server-side;
3. acquire a transaction-level lock or equivalent accepted concurrency control for
   the billing subject and plan;
4. verify eligibility;
5. reject stale or ambiguous state;
6. reject an existing active, trialing, incomplete, processing, or conflicting
   subscription unless approved recovery behavior applies;
7. durably reserve the local checkout operation before calling Stripe;
8. store a canonical request hash;
9. use a deterministic stable Stripe idempotency key with no PII;
10. retry an ambiguous provider call with the same key;
11. use only the exact approved test Price and fixed quantity;
12. disable browser-adjustable quantity;
13. disable promotion codes unless approved;
14. apply the exact approved tax policy;
15. use allowlisted success and cancel routes built from the approved staging origin;
16. attach only opaque internal IDs and version markers in metadata;
17. attach required correlation metadata to the resulting Subscription as well as the
    Checkout Session when current Stripe semantics require separate metadata fields;
18. never put names, emails, phone numbers, addresses, learner information, or
    credentials in metadata;
19. never grant entitlement;
20. never persist the hosted Checkout URL;
21. audit the operation safely.

Use `client_reference_id` only as an opaque checkout-attempt correlation value, never
as proof of identity.

When a canonical active Customer mapping exists, pass that Customer only after
account/mode/subject validation.

When no Customer mapping exists:

- follow current approved Checkout behavior for creating the Customer;
- correlate the resulting Customer solely through authenticated webhook data and
  opaque internal metadata;
- never map by email;
- do not expose the Customer ID to the browser;
- do not permit portal access until the mapping is durably verified.

Prefer a same-origin form POST that can receive a `303` redirect directly to the
Stripe-hosted URL. This keeps the URL out of application JSON and JavaScript state.
Do not log the `Location` value.

The browser success route must say that payment is being confirmed. It must not say
“Paid,” “Active,” or “Subscribed” until authenticated webhook processing or
reconciliation has produced authoritative internal state.

===============================================================================
18. CUSTOMER PORTAL SESSION CREATION
===============================================================================

Portal sessions must be created just in time.

The action must:

- require the authenticated relationship-scoped parent capability;
- require explicit CSRF proof;
- require a valid server-issued action token;
- apply durable rate limiting under accepted conventions;
- resolve the canonical active Customer mapping server-side;
- verify provider account, mode, subject, account, product, and archive state;
- use the exact approved portal configuration ID;
- use only an allowlisted return route on the approved parent shell;
- audit safely;
- return a direct private/no-store `303` redirect;
- never persist the portal session ID or URL;
- never expose a reusable portal URL in JSON, browser storage, logs, analytics, or
  evidence.

Fail closed for:

- absent mapping;
- multiple active mappings;
- wrong account or mode;
- archived mapping;
- stale reconciliation;
- provider outage;
- a portal configuration that permits an unapproved action.

Do not use Stripe Customer email matching to recover a mapping.

===============================================================================
19. WEBHOOK INGRESS
===============================================================================

There must be exactly one canonical Stripe webhook route.

Use the accepted OT-60 route if present. The preliminary OT-46 candidate proposed a
provider webhook route, but did not centrally mount it. Do not mount both a generic
provider route and a new Stripe route.

Register the raw webhook route before global `express.json()` and
`express.urlencoded()` middleware.

Requirements:

- POST only;
- exact content type;
- bounded body, initially no greater than the accepted 64 KiB limit unless current
  evidence justifies a smaller limit;
- raw request bytes;
- `Stripe-Signature`;
- official Stripe SDK signature verification;
- exact endpoint secret for the approved test endpoint;
- current official timestamp tolerance, normally the library default of 300 seconds;
- tolerance must never be zero;
- accurate server clock;
- test-mode and account binding;
- endpoint API-version verification;
- durable inbox insert before acknowledgement;
- no full payload or signature logging;
- no CSRF requirement on the provider webhook;
- no browser session or email authorization;
- no synchronous entitlement, invoice, or subscription projection work before
  acknowledgement.

Response behavior:

- malformed body: `400`;
- missing or invalid signature: `400`;
- oversized body: `413`;
- live-mode event: reject and alert;
- wrong account or mode: reject and alert;
- duplicate matching event: successful `2xx`, no second processing;
- same event ID with contradictory digest: security/manual-review path;
- unknown but valid event type: durably record minimal identity, mark ignored, and
  return `2xx`;
- newly accepted event: commit inbox state, enqueue or make claimable, then quickly
  return `2xx`.

A webhook `200` proves only durable receipt. It does not prove projection,
reconciliation, payment, or entitlement.

===============================================================================
20. EVENT ALLOWLIST AND ASYNCHRONOUS PROCESSING
===============================================================================

Derive the exact event allowlist from:

- approved payment methods;
- approved trial/free policy;
- approved cancellation, refund, dispute, and entitlement policy;
- current Stripe API version;
- actual Checkout and portal behavior.

Do not subscribe to `*`.

At minimum evaluate whether the approved model requires:

- `checkout.session.completed`
- `checkout.session.expired`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.paused`
- `customer.subscription.resumed`
- `customer.subscription.trial_will_end`
- `invoice.created`
- `invoice.finalized`
- `invoice.finalization_failed`
- `invoice.paid`
- `invoice.payment_failed`
- `invoice.payment_action_required`
- `invoice.voided`
- `invoice.marked_uncollectible`
- current refund-created, refund-updated, and refund-failed events;
- current dispute-created, dispute-updated, dispute-closed, and relevant funds-state
  events.

Re-verify exact event names in current official documentation. Include only those
genuinely needed.

Process asynchronously through the accepted worker architecture.

The worker must:

- claim rows transactionally;
- support multiple worker processes;
- use `FOR UPDATE SKIP LOCKED` or the accepted equivalent;
- use generation-safe leases;
- recover expired leases;
- use bounded attempts and backoff;
- distinguish retryable, permanent, ignored, contradictory, and manual-review
  outcomes;
- never process the same event generation twice;
- tolerate duplicated, delayed, and out-of-order events;
- retrieve current canonical Stripe objects when a snapshot may be stale or missing;
- verify every retrieved object’s account, mode, Customer, Price, Product, and
  metadata correlation;
- use transactions for projection and entitlement updates;
- make projection writes idempotent;
- audit every applied or blocked state transition;
- never treat event delivery order as object version order.

For semantic duplicates represented by separate Stripe Event objects, compare the
provider object ID, event type, relevant object state, and internal projection
revision. Do not merely compare Event IDs.

===============================================================================
21. DETERMINISTIC STATE PROJECTION
===============================================================================

Implement explicit transition tables for:

- checkout attempt;
- Customer mapping;
- Subscription;
- Subscription Item;
- Invoice;
- Refund;
- Dispute;
- reconciliation;
- entitlement.

Every transition must define:

- accepted source event or reconciliation source;
- required correlations;
- current-state preconditions;
- resulting state;
- whether it is monotonic;
- whether it requires manual review;
- audit event;
- entitlement consequence;
- UI vocabulary.

Never default a missing amount to zero, a missing currency to USD, or an unknown
status to paid/active.

The internal UI status model must truthfully support:

- no billing account;
- internal free access;
- Stripe trialing when approved;
- incomplete checkout;
- processing/confirming;
- active;
- past due in approved grace;
- past due suspended;
- payment action required;
- canceled at period end;
- canceled;
- unpaid;
- paused if supported;
- refund pending;
- refund completed;
- refund failed;
- dispute open;
- dispute resolved;
- provider unavailable;
- stale reconciliation;
- contradictory state/manual review;
- policy blocked.

A redirect, Checkout return, PaymentIntent success, or webhook `200` is not enough to
set an active entitlement.

===============================================================================
22. RECONCILIATION
===============================================================================

Implement periodic test-mode reconciliation using the accepted worker.

Reconciliation must:

- be disabled by default;
- run only in approved test mode;
- enumerate only internally mapped Customers and Subscriptions;
- use bounded pages and time;
- verify account and mode on every provider response;
- retrieve current Customer, Subscription, Subscription Items, latest relevant
  Invoices, Refunds, and Disputes;
- compare them to internal projections;
- repair safe drift transactionally;
- never create a second entitlement;
- never overwrite a contradictory mapping;
- never delete history;
- place ambiguous mappings in manual review;
- audit drift and repair;
- use durable cursors, leases, and backoff;
- expose only safe status and timestamps to the parent screen.

Add an operator-controlled reconciliation command or accepted worker operation that
is unavailable to parents and students. It must use accepted capability and
account/product scope, not a platform-wide super-admin shortcut.

===============================================================================
23. ENTITLEMENT INTEGRITY
===============================================================================

Stripe is an input to an internal entitlement projector. It is not an authorization
token.

Implement the exact resolved:

- free-access/trial policy;
- failed-payment grace;
- cancellation timing;
- refund behavior;
- dispute behavior;
- reactivation behavior;
- tier and benefit mapping;
- entitlement-effective policy.

Do not infer any transition.

Required rules:

- grant or revoke only for the immutable internal billing subject and approved plan;
- account, product, household, learner/benefit relationship, and policy version must
  match;
- email, browser return, Customer ID supplied by a client, payment-link click, raw
  provider status, or unverified message can never grant access;
- preserve attendance, progress, content history, learner records, and audit history
  when access changes;
- protected class/library routes consult internal effective entitlement, not Stripe
  in real time;
- a parent’s billing authority does not automatically give the parent learner access;
- a learner entitlement does not give the learner billing access;
- scheduled cancellation follows the approved period-end rule;
- a fully canceled subscription requires the approved new-subscription/reactivation
  path;
- refunds and disputes use their explicit policies;
- stale or contradictory reconciliation fails safe.

If free access is internal rather than a Stripe trial, model it as an internal
entitlement source and do not create a fake zero-price subscription or Stripe trial.

If a Stripe trial is approved, use only the Checkout-compatible current mechanism and
the exact approved end timestamp. Do not use a preview Trial Offer unless explicitly
authorized.

===============================================================================
24. PARENT BILLING UI
===============================================================================

Use the accepted OT-52 shell, navigation, API adapter, state conventions, and design
system. Add the smallest complete Billing subsection.

The section must include:

- a truthful summary card;
- plan and tier display name;
- amount, currency, and billing cadence;
- exact display timezone;
- free-access, trial-end, or current-period date as applicable;
- truthful status and stale-state indicator;
- bounded invoice/receipt history;
- safe invoice/receipt opening;
- Subscribe or Complete setup only when permitted;
- Manage billing only when a verified Customer mapping exists;
- Cancel or Resume only when approved policy and current server state permit;
- support-ticket entry through the accepted support boundary;
- clear next steps for payment failure, provider outage, stale state, or policy block.

Implement all states:

- loading;
- empty;
- no billing subject;
- internal free access;
- trial;
- checkout processing;
- active;
- past due;
- cancel-at-period-end;
- canceled;
- refund pending/completed/failed;
- dispute/manual review;
- provider partial failure;
- stale reconciliation;
- offline;
- permission denied;
- session expired;
- support submitted or support unavailable.

Design requirements:

- existing black/yellow One Time tokens;
- existing canonical header, footer, shell, and navigation;
- readable names and headings;
- mobile-first cards;
- no horizontal overflow;
- 360×800 and 390×844 verification;
- keyboard operability;
- visible focus;
- focus restoration after dialogs or navigation;
- screen-reader status announcements that do not overstate success;
- logical CSS properties and RTL safety;
- reduced-motion support;
- 200% zoom and reflow;
- no duplicate navigation;
- no embedded Stripe Dashboard;
- no BNA shell or styling;
- no Operations or Super Admin chrome;
- no provider internals or raw IDs;
- no dead controls.

Do not load Stripe.js for hosted Checkout. Do not import the server Stripe SDK into
client code. Keep billing out of public landing/signup bundles and load the parent
Billing route lazily under the authenticated shell.

===============================================================================
25. SUPPORT TICKET BOUNDARY
===============================================================================

Use the accepted support-ticket capability and route. Do not create a second support
system.

A billing-support request may include only:

- internal safe request/reference ID;
- authenticated account/product scope;
- internal billing-subject public reference;
- parent-facing category;
- safe state code;
- reconciliation freshness;
- source application version;
- free-text parent message under accepted limits.

It must not include:

- Stripe IDs;
- hosted URLs;
- credentials;
- webhook payloads;
- payment-method details;
- full invoice payloads;
- card or bank data;
- another household’s existence;
- internal integration controls.

Route support to `{{APPROVED_BILLING_SUPPORT_OWNER}}` through the accepted support
workflow. If the accepted base lacks the required support capability, stop rather
than substituting email, a CRM note, or an external provider.

===============================================================================
26. SECURITY AND PRIVACY
===============================================================================

Enforce:

- server-side capability and relationship authorization on every read and write;
- explicit submitted CSRF proof for authenticated writes;
- no CSRF-cookie-only fallback;
- session-security-version behavior;
- private/no-store headers;
- strict request schemas;
- body limits;
- durable rate limits using accepted infrastructure;
- replay protection;
- short-lived action tokens;
- request and trace IDs;
- safe error envelopes;
- audit events;
- redacted logs;
- no open redirects;
- no full provider payload logging;
- no raw Stripe IDs in public routes;
- no PII or payment data in URLs;
- no PII or payment data in metadata;
- no PII, provider URLs, or secrets in browser storage, analytics, screenshots,
  fixtures, or evidence;
- no reusable Checkout or portal URL in persistence;
- no client secret outside a narrowly approved payment surface. Hosted Checkout
  should require none in the One Time client.

Extend the secret scanner to detect at least:

- Stripe secret and restricted keys;
- Stripe webhook secrets;
- live publishable keys;
- private keys;
- credential-bearing database URLs.

Never include a real or test payment-card number in source, fixtures, screenshots,
logs, or evidence. The staging operator may enter an official Stripe sandbox test
payment method directly into Stripe-hosted Checkout, but it must not be recorded.

Use fictional names and addresses for test-mode objects.

===============================================================================
27. DETERMINISTIC FAKE ADAPTER AND HARD NETWORK DENY
===============================================================================

Ordinary unit, integration, browser, accessibility, performance, and CI tests must
use a deterministic fake provider adapter.

The fake must model:

- Checkout creation;
- portal creation;
- signature verification;
- duplicate events;
- out-of-order events;
- subscription state changes;
- invoice states;
- failed payment and recovery;
- cancellation and resumption;
- refunds;
- disputes;
- provider timeout;
- ambiguous result;
- reconciliation drift;
- wrong account and wrong mode.

Add a process-level external-network deny for ordinary tests. It must reject nonlocal
HTTP, HTTPS, TCP, and TLS connections while allowing:

- loopback application server;
- the explicitly approved disposable PostgreSQL host;
- Playwright’s local browser connection.

No ordinary test may contact Stripe, a webhook endpoint, Railway, BNA, or another
external provider.

The real Stripe adapter must fail construction when ordinary test/CI network mode is
active.

===============================================================================
28. TEST MATRIX
===============================================================================

Add focused tests under existing test conventions.

Unit tests must cover:

- commercial JSON validation;
- currency and minor-unit validation;
- recurring interval/count;
- Product/Price/account/configuration binding;
- test/live mode rejection;
- startup config dependencies;
- idempotency request hashing;
- same-key/same-request replay;
- same-key/different-request conflict;
- provider error classification;
- redaction;
- metadata minimization;
- return-route allowlisting;
- status vocabulary;
- every entitlement policy branch;
- free access/trial;
- failed-payment grace;
- cancellation;
- reactivation;
- refund;
- dispute;
- stale and contradictory state.

Integration tests must cover:

- authorized parent;
- unrelated parent;
- sibling or learner denial;
- student denial;
- wrong account;
- wrong product;
- wrong household;
- archived relationship;
- expired session;
- changed session-security version;
- missing/invalid CSRF;
- cookie-only CSRF rejection;
- no-store;
- ambiguous Customer mapping;
- archived Customer mapping;
- duplicate checkout requests;
- concurrent checkout requests;
- duplicate active subscription prevention;
- provider timeout and retry with the same idempotency key;
- open-redirect attempts;
- portal wrong mode/account;
- invoice public-reference authorization;
- support-context sanitization.

Webhook tests must cover:

- valid signature;
- invalid signature;
- wrong secret;
- missing signature;
- malformed body;
- parsed-body misuse;
- oversized body;
- timestamp outside tolerance;
- replay;
- duplicate same Event;
- same Event ID with contradictory digest;
- semantic duplicate as separate Event;
- out-of-order events;
- unknown event;
- wrong account;
- wrong mode;
- live event;
- malformed metadata;
- unknown Customer;
- Customer correlation mismatch;
- incomplete subscription;
- active subscription;
- failed payment;
- recovery;
- cancellation at period end;
- deletion;
- pause/resume when supported;
- refund pending/succeeded/failed;
- dispute opened/updated/closed;
- worker crash and lease recovery;
- concurrent workers;
- missed-event reconciliation;
- projection monotonicity;
- entitlement idempotency.

Real PostgreSQL proof must cover:

- complete migration chain;
- migration checksum readback;
- repeated `db:verify`;
- all foreign keys;
- partial unique indexes;
- mode/account scope;
- request-hash conflicts;
- checkout reservation concurrency;
- Customer mapping conflicts;
- event duplicate races;
- inbox claims;
- lease expiry and generation safety;
- out-of-order projection;
- reconciliation concurrency;
- transaction rollback;
- audit append-only behavior.

Browser journeys must cover:

- no billing account;
- internal free access;
- approved trial;
- checkout start;
- browser return still processing;
- active subscription;
- manage billing;
- cancel/resume where approved;
- invoice list and safe opening;
- provider outage;
- stale reconciliation;
- wrong role;
- session expiry;
- support ticket;
- offline state;
- 360×800;
- 390×844;
- tablet and desktop.

Accessibility and usability proof must cover:

- axe checks;
- keyboard-only operation;
- focus order;
- focus restoration;
- accessible names;
- status announcements;
- touch targets;
- RTL;
- reduced motion;
- 200% zoom/reflow;
- no horizontal overflow.

Performance and bundle proof must cover:

- public JS remains within accepted budget;
- public landing/signup contain no billing, React, Stripe, or parent bundle;
- authenticated parent Billing is route-chunked;
- Stripe Node SDK absent from browser bundles;
- no BNA or Operations import;
- LCP ≤ 2.5 seconds;
- CLS ≤ 0.1;
- visible/actionable user-centered timing;
- no unnecessary provider request during initial parent-shell load.

Run:

    npm run secret:scan
    npm run format
    npm run lint
    npm run typecheck
    npm run unit
    npm run integration
    npm run build
    npm run e2e
    npm run accessibility
    npm run performance
    npm run verify
    git diff --check

Also run focused OT-65 slices explicitly and record their exact commands and counts.

===============================================================================
29. DISPOSABLE POSTGRESQL GATE
===============================================================================

pg-mem is supplemental only. It cannot satisfy OT-65’s migration, constraint, locking,
or concurrency gate.

Require:

- `OT65_DISPOSABLE_DATABASE_URL`
- `OT65_DISPOSABLE_DATABASE_APPROVED=YES`

The database must be newly created for OT-65 synthetic testing and must not be:

- production;
- BNA;
- One Time live;
- Railway production;
- a shared customer database;
- a database containing real users or billing records.

Do not print the URL.

Before migration, verify:

- current database name;
- current server version;
- database name follows the approved disposable naming convention;
- no unexpected application schemas or customer rows exist;
- PostgreSQL version matches the supported repository version.

Then run:

    DATABASE_URL="$OT65_DISPOSABLE_DATABASE_URL" npm run db:migrate
    DATABASE_URL="$OT65_DISPOSABLE_DATABASE_URL" npm run db:verify

Run the focused real-PostgreSQL OT-65 test suite with multiple independent clients.

Record:

- PostgreSQL major version;
- migration IDs and SHA-256 checksums;
- first-apply result;
- second-verify result;
- constraint scenarios;
- concurrency counts;
- transaction results;
- clean synthetic teardown state.

Do not drop, alter, or inspect any unapproved database.

If no safe disposable PostgreSQL is available, mark
`BLOCKED_REAL_POSTGRESQL_UNAVAILABLE`; do not claim Gate R complete.

===============================================================================
30. TEST-MODE STAGING ACTIVATION GATE
===============================================================================

Do not begin canary activation until all repository and PostgreSQL gates pass and the
working tree is clean at an immutable OT-65 commit.

Before canary, verify:

- source SHA is exact and recorded;
- staging target is exactly `{{APPROVED_STAGING_DEPLOYMENT_TARGET}}`;
- origin is exactly `{{APPROVED_STAGING_PUBLIC_ORIGIN}}`;
- deployment is nonproduction;
- `LIVE_STRIPE_CHARGES_AUTHORIZED=NO`;
- only test credentials are injected through protected secret storage;
- account/Product/Price/portal fingerprints match preflight;
- Product and Price remain active and test mode;
- migration checksums match;
- webhook endpoint is test mode;
- webhook endpoint URL exactly matches the approved staging origin and canonical
  webhook path;
- webhook endpoint API version matches;
- enabled events exactly match the reviewed allowlist;
- return URLs exactly match the allowlist;
- portal configuration still matches policy;
- rollback controls have been tested with fixtures;
- no Dashboard setting needs modification.

Do not create or modify:

- Product;
- Price;
- coupon;
- promotion code;
- portal configuration;
- tax configuration;
- live endpoint;
- live object.

A pre-existing approved test webhook endpoint may be used. If its URL, API version,
account, mode, or event allowlist is wrong, stop. Do not silently update it.

The canary consists of exactly one operator-controlled fictional test journey unless
the director explicitly authorizes a larger test count:

1. Authenticate through the accepted One Time parent test session.
2. Open the relationship-scoped Billing screen.
3. Start Checkout.
4. Confirm that One Time created one local checkout attempt.
5. Complete Stripe-hosted Checkout with an official sandbox test payment method
   entered manually by the operator.
6. Return to One Time and confirm the UI remains “processing/confirming.”
7. Confirm the authenticated webhook event was durably accepted.
8. Confirm asynchronous projection.
9. Confirm internal entitlement according to approved policy.
10. Confirm invoice/receipt projection.
11. Confirm a just-in-time portal session and allowlisted return.
12. Resend the same test event through the approved Stripe test mechanism and prove
    duplicate safety.
13. Run reconciliation and prove no duplicate entitlement or destructive overwrite.
14. Execute the rollback drill.

Do not record:

- test card number;
- customer email;
- name;
- address;
- full Stripe IDs;
- hosted URLs;
- event payload;
- endpoint secret;
- API key.

Record only:

- immutable source SHA;
- safe object fingerprints;
- object counts by safe type;
- event types;
- state-transition result;
- migration checksums;
- timestamps;
- zero live-object assertion;
- zero live-webhook assertion;
- zero live-charge assertion.

Test-mode objects that may arise from the single approved canary include:

- one test Checkout Session;
- one fictional test Customer when needed;
- one test Subscription;
- generated test Invoice, PaymentIntent, and Charge objects;
- one or more test webhook Events;
- one just-in-time portal session.

List the actual safe counts in evidence. Do not delete history to make the counts look
clean.

===============================================================================
31. ROLLBACK
===============================================================================

Rollback must be reversible and non-destructive.

Provide independent controls to:

- disable new Checkout session creation;
- disable new portal session creation;
- keep live mode impossible;
- preserve webhook acceptance while already-created test operations drain, when
  needed;
- stop worker claims safely after the current lease completes;
- stop periodic reconciliation;
- place internal access in the exact approved safe state;
- preserve events, mappings, subscriptions, invoices, refunds, disputes,
  entitlements, and audits;
- prevent silent retries with new idempotency keys.

The rollback drill must prove:

1. turning off Checkout prevents a new provider session;
2. turning off portal creation prevents a new portal session;
3. no queued event is lost or duplicated;
4. worker shutdown respects leases;
5. reconciliation stops;
6. existing internal history remains readable to authorized operators;
7. parent UI shows a truthful unavailable/stale/support state;
8. no live path becomes available;
9. re-enabling the approved test flags restores service without remapping Customers
   or duplicating entitlements.

Do not delete test records, edit migration history, or reset the Stripe test account.

===============================================================================
32. GIT BEHAVIOR
===============================================================================

Use intentionally scoped commits. A suitable sequence is:

1. additive migration, contracts, and domain policies;
2. Stripe gateway, webhook inbox, worker, and reconciliation;
3. parent API and Billing UI;
4. fixtures, tests, evidence, and rollback controls.

Do not force-push. Do not rewrite accepted history. Do not merge.

Before every commit:

    npm run secret:scan
    npm run lint
    npm run typecheck
    git diff --check

Before push, run the complete required matrix.

Verify no forbidden path changed:

    git diff --name-only "$OT65_BASE"...HEAD

Verify clean status:

    git status --short

Push only after required local and disposable-PostgreSQL gates pass:

    git push -u origin codex/ot65-stripe-parent-billing-test-mode

Open a draft PR against the exact approved base branch:

    gh pr create \
      --repo webcraft-media/onetimev2 \
      --draft \
      --base "$OT65_BASE_BRANCH" \
      --head codex/ot65-stripe-parent-billing-test-mode \
      --title "OT-65 Stripe test-mode activation and Parent Billing" \
      --body-file ops/evidence/ot-65/PR-BODY.md

Immediately verify that the PR base SHA is still `"$OT65_BASE"`. If the base branch
advanced, mark the PR blocked and stop. Do not rebase or merge automatically.

Do not deploy production, merge, mutate live Stripe, charge anyone, or authorize live
mode.

===============================================================================
33. EVIDENCE
===============================================================================

Create sanitized evidence under `ops/evidence/ot-65/`:

- `PREFLIGHT.md`
- `ACCEPTED-HEADS-AND-CONTAINMENT.md`
- `INSTRUCTION-READBACK.md`
- `COLLISION-AND-OWNERSHIP.md`
- `MIGRATION-LEDGER-BEFORE.md`
- `MIGRATION-AND-CONSTRAINT-PROOF.md`
- `ARCHITECTURE-AUDIT.md`
- `COMMERCIAL-DECISIONS.md`
- `STRIPE-DOCS-VERIFICATION.md`
- `STRIPE-TEST-OBJECT-PROOF.md`
- `AUTHORIZATION-MATRIX.md`
- `CHECKOUT-IDEMPOTENCY-AND-CONCURRENCY.md`
- `WEBHOOK-INGRESS-AND-REPLAY.md`
- `EVENT-ALLOWLIST.md`
- `RECONCILIATION-AND-DRIFT.md`
- `ENTITLEMENT-POLICY-MATRIX.md`
- `PARENT-BILLING-UI.md`
- `SECURITY-PRIVACY-AND-REDACTION.md`
- `NETWORK-DENY.md`
- `POSTGRESQL-PROOF.md`
- `TEST-RESULTS.md`
- `STAGING-CANARY.md`
- `ROLLBACK.md`
- `CHANGED-FILES.txt`
- `PR-BODY.md`
- `FINAL-REPORT.md`

Evidence must be reproducible but sanitized. Never include:

- credentials;
- environment values containing secrets;
- raw Stripe responses;
- full Stripe IDs;
- event payloads;
- signatures;
- hosted URLs;
- customer data;
- payment credentials;
- real or test card numbers;
- production hostnames or database credentials;
- screenshots containing PII.

Use SHA-256-derived truncated fingerprints for provider object correlation.

===============================================================================
34. FINAL REPORT CONTRACT
===============================================================================

Write:

`ops/evidence/ot-65/FINAL-REPORT.md`

It must include:

1. Identity

   - repository;
   - exact approved base branch and SHA;
   - accepted OT-46, OT-52, and OT-60 SHAs;
   - OT-65 branch;
   - final head SHA;
   - draft PR URL;
   - execution date/timezone.

2. Changed files

   - exact path list;
   - file-ownership rationale;
   - confirmation that no BNA/Operations/production path changed.

3. Migration

   - exact migration filename;
   - SHA-256 checksum;
   - ledger before/after;
   - first apply and repeated verify;
   - real PostgreSQL version;
   - constraint/concurrency results.

4. Commercial configuration

   - safe approved amount, currency, cadence, plan display name, tier, benefits,
     timezone, and policy versions;
   - no provider IDs;
   - no remembered-value substitution.

5. Implementation status

   Distinguish each item exactly as one of:

   - implemented in code;
   - verified with fixtures;
   - verified with disposable PostgreSQL;
   - verified in Stripe test mode;
   - webhook-confirmed;
   - parent-UI verified;
   - entitlement-reconciled;
   - blocked;
   - untouched;
   - live activation not authorized.

6. Tests

   - exact commands;
   - exact pass/fail/skip counts;
   - baseline exceptions;
   - network-deny result;
   - secret/PII/raw-ID/open-redirect/browser-storage scans;
   - accessibility, RTL, zoom, and mobile proof;
   - bundle and performance measurements.

7. Test-mode external mutations

   - safe object counts by type;
   - truncated fingerprints;
   - zero live objects;
   - zero live webhooks;
   - zero live charges;
   - no Product, Price, coupon, portal-config, tax-config, or live-setting mutation.

8. Rollback

   - controls;
   - drill results;
   - queue/lease state;
   - entitlement safe state;
   - preserved history.

9. Blockers and untouched scope

   - every unresolved item;
   - exact unblock condition;
   - explicit live-mode prohibition.

10. Git status

    - exact base/head;
    - clean working tree;
    - no unpushed commits unless explicitly reported.

===============================================================================
35. BLOCKED EXECUTION BEHAVIOR
===============================================================================

If blocked before worktree creation:

- make no repository changes;
- output the exact blocker code and the evidence inspected;
- do not create a branch, commit, PR, or evidence-only change.

If blocked after work begins:

- stop at the last coherent, tested phase;
- do not weaken a gate;
- do not leave half-mounted routes or unsafe feature flags;
- keep all network features disabled;
- preserve coherent work in intentionally scoped commits;
- write an exact checkpoint and blocker in `FINAL-REPORT.md`;
- leave the OT-65 worktree clean;
- push or update a draft PR only when the checkpoint is safe and local required gates
  for that checkpoint pass;
- do not merge or deploy.

Never solve a blocker by:

- choosing a remembered commercial value;
- using email matching;
- substituting a different Product or Price;
- creating or modifying a Stripe configuration;
- using a live key;
- using production data;
- bypassing real PostgreSQL proof;
- suppressing a failed security test;
- broadening owner/admin access;
- exposing a provider ID or URL;
- duplicating accepted infrastructure;
- changing BNA.

===============================================================================
36. REQUIRED FINAL CODEX RESPONSE
===============================================================================

At completion, report only what actually occurred.

The response must state:

- exact status;
- base, branch, and head SHA;
- draft PR URL when created;
- migration and checksum;
- tests and evidence;
- whether the test-mode canary ran;
- webhook confirmation status;
- parent-UI verification status;
- entitlement reconciliation status;
- blockers;
- rollback state;
- `LIVE_STRIPE_CHARGES_AUTHORIZED=NO`;
- live activation not authorized.

Do not claim production readiness merely because code, fixtures, PostgreSQL tests, or
a Stripe test-mode canary passed. Do not merge, deploy production, or perform another
prompt-generation pass.
