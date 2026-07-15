# OT-75 Owner/Admin Bootstrap Procedure

OT-75 prepares the procedure only. It does not create users or store secrets.

## Procedure For A Later Approved Activation

1. Create or verify the owner/admin account through the approved runtime path.
2. Generate any temporary credential outside Git and outside release evidence.
3. Require MFA enrollment through the product or identity provider.
4. Store only redacted evidence: account role, status, MFA enrolled boolean,
   timestamp, and operator approval reference.
5. Never store a password, recovery code, MFA seed, session cookie, email body,
   phone number, or provider token in Git or evidence.

## Gate Mapping

`GATE-OWNER-ADMIN-BOOTSTRAP` passes only when a redacted evidence report exists
and confirms no secret material was stored.
