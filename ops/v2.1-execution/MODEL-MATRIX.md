# Model and Reasoning Matrix

Every prompt already contains its recommended setting at the very top.

| Task type | Codex UI setting | Why |
|---|---|---|
| Control tower, graph correction, architecture seams | **GPT-5.6-SOL / Extra High** | Cross-repository reasoning and high-cost coordination errors |
| Schema, migrations, auth, authorization, tenant isolation | **GPT-5.6-SOL / Extra High** | Security and irreversible data constraints |
| Billing/access, privacy/erasure, provider foundations, Zoom, recovery/cutover | **GPT-5.6-SOL / Extra High** | Financial, child-data, external-effect, and release risk |
| Normal full-stack implementation | **GPT-5.6-SOL / High** | Strong implementation with better throughput |
| Isolated UI/copy/styling after contracts freeze | **GPT-5.6-TERRA / High** | Fast leaf execution with bounded decision surface |
| Mechanical documentation/checksum/catalog work | **GPT-5.6-TERRA / Medium** | Cheap deterministic work only |

Use the Priority service tier for every lane if available.

Do not “upgrade everything” to SOL Extra High. It reduces throughput without helping isolated copy or leaf UI tasks. Do not assign Terra independent decisions about schema, authentication, authorization, privacy, billing, migrations, provider authority, or cross-cutting architecture. If a Terra task encounters one, it checkpoints the safe work and sends the exact issue to its SOL owner.
