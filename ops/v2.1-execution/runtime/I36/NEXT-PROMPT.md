MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: CONTINUE

Audit and reconcile the exact accepted-source-microbatch-2 terminal runtime
release before resuming I36.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-integration
Runtime-final parent: `1bedb166fdc18045b4d2630da10e208168c5eb4c`
Containing control: `98e7b05c7d256d55fd8a4dbd829230e42303e67e`
Authorizing/state-basis control: `26f29aeb6734948dd8b80ab85a342831defaecc9`
Claim: `77b3e5e2-bc2f-4c74-95c1-6bd61a4884a6`
Lease: `3043fafc-a550-487a-9109-76dc7373caff`, released before expiry

Exact admitted merge results:

1. F04 `98cc221f3b5dcb9d8d4038015dd4d4c96817618d`
2. P09 `3f9c699eacc3190fe4d2d38d2e61e85d793ac099`
3. Lane B/F07 `1bedb166fdc18045b4d2630da10e208168c5eb4c`

The exact source scope is 30 paths and the release scope is 33 paths. Focused
Vitest passed 41 tests with one source-declared native-PostgreSQL skip;
migration verification passed 7/7; typecheck, production build, focused lint,
CRLF-aware Prettier, YAML, secret, diff, ancestry, and remote gates passed.
The built-static landing browser/accessibility replay passed 7/7.

The normal command
`npm exec -- playwright test tests/e2e/landing-signup.spec.ts` fails before
any spec because the unchanged shared `e2e_class_occurrence` fixture omits
required `join_opens_at`. The same exact error reproduces at base `4bc8e7a8`.
Do not treat it as a source regression or edit the shared fixture without a
new owner-bound grant.

C00 must audit the exact pushed terminal head, consume I36 READY, reconcile
the three source items, retain blocker
`F04-OWNERSHIP-TRANSFER-REVOCATION-COLUMNS`, and issue a new exact READY/lease
for the next bounded integration checkpoint. Do not apply central feature
registrations, F03/P08 session composition, configuration, provider/GHL
registries, candidate state, deployment, or external effects from this
prompt. Effects are `0/0/0`.
