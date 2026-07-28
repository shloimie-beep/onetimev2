# P29 Next Prompt

Validate and integrate the exact pushed `codex/v21-p29-core-workflows`
ready-for-review head.

Use the task-local `TASK-STATE.yaml` and `HANDOFF.md` as durable truth. Confirm:

1. the implementation descends from start
   `49431959f58f284bdc13ca931acf09f980fc483a`;
2. implementation commit
   `0a42c8701d75d2a15e59c5e7a2f4a3e5d7fb0d18` is present unchanged;
3. all 12 workflow identities, desired states, senders, message classes, and
   exact triggers match the integrated P28 canonical registry;
4. all 29 focused assertions, full typecheck, focused lint/format, secret scan,
   and diff check pass;
5. only the declared P29 roots plus task-local runtime/steward-request paths
   changed;
6. external effects remain zero and the GHL_CORE_WORKFLOWS lease is released.

Then integrate the exact P29 head and adjudicate:

- `P29-registration-001`
- `P29-registry-projection-001`
- `P29-config-001`

Do not hand-edit generated projections, invent provider IDs, broaden arbitrary
workflow-key syntax, create Student contacts, bind WhatsApp, publish workflows,
enroll contacts, send messages, run provider canaries, or mutate financial or
access state without a later explicit candidate-bound authorization.
