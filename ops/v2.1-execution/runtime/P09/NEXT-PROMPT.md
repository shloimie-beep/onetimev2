MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: INDEPENDENT_REVIEW

Independently audit the superseding P09 School inquiry correction final.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p09-school-inquiry
Rejected final: a81e5e98e21eeb1df8d0ff21dd6b948a33a65d46
Correction claim: 86d5f5ffd046505c4df336ea40dd83c6559d3255
Reconciled control: 3fd19332799a28a7efd7cde00712ba8ca091bf14
State-based acquisition: e6a6729bc109816124ef2e7beef5e42aa398b147
Correction implementation: a420dd5823c0f7a7dc553fd08991c0e4507b8c24
Claim: 555a5878-9a7f-4486-a6e0-a959dc9ab1a1
SCHOOL_INQUIRY lease: 8ca16a74-fa49-4c61-8aa8-b50416b50913
Lease released: 2026-07-29T11:41:43Z before expiry

Task state: ops/v2.1-execution/runtime/P09/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P09/HANDOFF.md

Reproduce:

- exact claim → implementation → final sole-parent chain;
- six-file correction scope plus three P09 runtime-memory files;
- nine-artifact digest
  `1635950b5f6eb1a117912199bdc8b8d2bf36bd5c5397c3388bcbc1990c746a57`;
- unchanged migration request
  `f6612a8c3b435ca86f8dd8c5ce18ea9a1d91d4c4c0348fb5607eb6681c66b5df`;
- unchanged registration request
  `f78ab4076227222509f61b5d430188cbdaee369adf0bd6ebe82703482171fef1`;
- unchanged request aggregate
  `9229edbdabbeedc6ee7ad17eef595ff36e5f6b99f72b0ea73d23e05ab08ddb42`;
- four focused files / 16 tests, workspace typecheck, focused lint/format,
  scope/diff hygiene, and secret scan.

Adversarially prove:

- concurrent same-normalized-email submissions produce exactly one durable
  inquiry/lead and one acknowledgment intent, with the loser returning exact
  deduplication or failing closed on changed canonical fields;
- exactly four required fields succeed, omitted phone/note persist as `null`,
  and extra fields fail before persistence;
- the acknowledgment intent binds `OT-01.school_acknowledgment` version
  `2.1.0`, sender `office`, exact approved subject/body, and content digest
  `ee97274c3fbe2bae470da87aa15b7049fddc2677dc794dc5e94a42e78b7de4fb`;
- UI success copy is not used as delivery copy and template drift fails closed;
  and
- all prior zero account/access/subscription/nurture and approved-School
  Parent/Student reuse invariants remain.

Do not apply either structured request, inspect/mutate providers, send an
acknowledgment, or perform any external effect during source review. Effects
remain `0/0/0`.
