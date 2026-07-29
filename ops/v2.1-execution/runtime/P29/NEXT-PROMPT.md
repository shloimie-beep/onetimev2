# P29 Corrected Core Workflows — Review Prompt

Review the exact pushed `codex/v21-p29-core-workflows` final head against
implementation commit `cad2c6f2a8aeb875dcf5122ae1ebe9ca012bf507` and reconciled
authorization `268ab601b89573238befe70de7995908925575cc`.

Confirm:

1. all 12 workflows, including OT-02B, fail closed on independently trusted
   audience and copy approval;
2. actual content and audience digests exactly match the trusted approved
   digests before reservation or delivery;
3. requirement IDs and acceptance-case IDs are exact and separate;
4. OT-01 explicitly projects the `one_time_family_signup` lifecycle;
5. OT-10 requires Admin approval and provider-readback evidence before planning,
   reservation, delivery, and provider readback;
6. the fragment and all three steward-request SHA-256 digests match
   `TASK-STATE.yaml`;
7. external effects remain zero and no migration exists.

Route the three steward requests through their owning lanes. Treat the known
sender-registry count assertion as an inherited registry-steward finding, not a
P29-owned failure.
