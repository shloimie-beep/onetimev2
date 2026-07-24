# OT-LAUNCH-01 — Structured Prompt Patches and Scoped Knowledge

## Queue

- Task: `OT-LAUNCH-01-PROMPT-KNOWLEDGE-01`
- Repository: `shloimie-beep/onetimev2`
- Planned branch: `codex/structured-prompt-scoped-knowledge`
- Start after the communication/Contacts contracts converge.
- Status remains in `BOARD.yaml`; this packet is not a second status model.

## C1 — Structured prompt patches

Preserve the existing prompt version, parent, checksum, activation, rollback,
and generation-run binding. Add one versioned structured prompt document with
stable sections:

- objective
- audience
- approved sources
- tone and voice
- channel and output format
- visual/camera/composition when applicable
- required elements
- forbidden elements
- citations
- safety

Natural-language feedback proposes only schema-valid, section/key-scoped patch
operations. Show the deterministic diff before save. Saving creates a new
immutable version; activation and rollback remain explicit. Every generation
pins the exact structured version/checksum. Never silently rewrite the whole
prompt or remove unrelated guardrails. Migrate legacy text through a reversible
renderer/compiler.

## C2 — Parent/Student scoped knowledge helper

Generalize the existing Student Class Helper port instead of adding LangChain,
LlamaIndex, a second retrieval store, or a new chat UI.

- Authorize before retrieval.
- Parent scope is one permitted household/selected Student.
- Student scope is exactly that learner.
- Retrieve only current approved, published, knowledge-approved class content.
- Return citations and abstain when support is missing.
- Resist prompt injection and recheck entitlement/revocation.
- Persist a database-backed rate limit; do not retain long-lived raw Q/A.
- Use one server-only model adapter behind the existing provider port.
- Converge existing retrieval implementations into one canonical adapter.
- The public GHL lead bot knowledge base remains separate.

## Acceptance

Structured schema, scoped patch/diff, guardrail preservation, immutable version,
checksum, rollback, concurrency, invalid-op rejection, legacy rendering,
Parent/Student/cross-household scope, citation validation, abstention, injection,
revocation, multi-instance rate limit, and provider-off fallback all pass.

Studio/OpenArt/characters/image generation, general web answers, private learner
notes, persistent chat memory, fine-tuning, and GHL lead-bot KB are out of scope.
