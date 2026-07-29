# P08 Family Signup — Review Prompt

Review the exact pushed `codex/v21-p08-family-signup` final head against product
implementation `7e20798c1161da0594cea363d1047335c9ae4fbe` and reconciled
authorization `d8639ce20ce92a0f49ce8d69b57b09b355d09246`.

Confirm:

1. Family and School are exact mutually exclusive public branches and malformed
   or hybrid API payloads produce no write;
2. the Family form is cardless and Student-free;
3. free access applies only before `2026-09-13T16:24:00.000Z`, while at/after
   persists inactive access and continues to Checkout without a rolling trial;
4. normalized adult and HumanAccount dedupe, generic duplicate handling, exact
   GHL matching, and identity-review quarantine preserve local access;
5. stable-key recovery cannot duplicate an adult, account, household,
   credential, outbox, or provider effect;
6. the corrected interface digest is
   `f54e4381b53aa83522a2b15561a51a03319272a439afa8657c13655776c0d23c`;
7. the migration and registration request digests match `TASK-STATE.yaml`;
8. no migration, shared registration, provider effect, or financial effect is
   present.

Integrate the interface checkpoint to unlock P09 and route both steward requests
through their owning lanes before integrating product behavior.
