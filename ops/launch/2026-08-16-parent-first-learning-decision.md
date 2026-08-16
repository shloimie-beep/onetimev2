# Parent-first learning launch decision

Date: 2026-08-16 (Asia/Jerusalem)

Status: `LAUNCH DECISION` / authoritative for the current Parent-first candidate

Operator decision: the Family account owner must receive immediate One Time learning access under the Parent login. The household supports one Parent learner plus up to three separate child Student accounts.

## Adult password and signup-form supersession

The operator additionally superseded the historical 12-character adult-password minimum for the active launch candidate. Adult passwords use a six-character minimum and 128-character maximum with no composition rule. Family signup enforces a shared bounded common-password list and identity-equivalent rejection. The domain's compromised-password rejection policy and hook remain in place, but this launch change does not add an external compromise-corpus lookup, so no corpus-backed rejection claim is made. The exactly six-digit numeric format remains exclusive to Student PINs. Family signup, adult activation/reset and password change, and current-password verification surfaces must accept a valid six-character adult password consistently.

The Family signup page has one visible heading, `Create Family Account`, with no repeated adult-management, seat, pricing, or free-period exposition above the form. Missing or invalid fields stay on the page, receive inline accessible errors, and focus the first invalid field. An explicitly stale pre-write signup security bootstrap may be renewed and retried once; ambiguous or potentially committed writes are never retried under a fresh operation key.

## Current behavior

- Successful Family signup creates the adult identity, HumanAccount, Parent role, Family household, authenticated Parent session, Parent learning participant, and canonical-class entitlement in one transaction.
- The browser submits the Family form to the application origin so its host-only session cookie is valid when the user opens the Parent application. No bearer handoff is introduced.
- The Parent lands directly in Parent Today and can open Parent-scoped Classroom, Library, and Questions before creating any child Student.
- The Parent learner is keyed to the adult identity and HumanAccount. It is not a fake Student, has no Student credential, and consumes none of the three child seats.
- The Parent may create and manage up to three child Student accounts. A fourth active child is denied.
- Parent attendance, playback authorization, progress facts, and private questions are attributed to the Parent participant. A Parent never borrows a child learner identity or gains access to a child's private question, answer, session, or history.
- Existing legacy `self` Student records remain separately manageable; the Parent-first journey does not create or require one.
- A dual-role Admin+Parent adult, including Rabbi Eli, must receive the same Parent participant and canonical entitlement when provisioned after the migration.

## Supersession

For the current launch candidate, this decision supersedes the retained v2.1 source package wherever it says that a Parent cannot learn, must consume a Student seat, must use separate Student credentials, or cannot use classroom/library/questions. Those historical source files and their existing checksum artifacts remain byte-unchanged by this decision. This decision neither refreshes nor re-attests their historical checksum relationship.

The following boundaries remain in force:

- assignable roles remain exactly `admin`, `parent`, and `student`;
- the standard child-seat limit remains three;
- Students have no email or GHL contact;
- Parent and child private learning facts remain isolated;
- Zoom and protected media are providers, never identity or entitlement authorities;
- inactive-access, cross-household, wrong-role, replay, and revocation denials remain fail-closed.

## Release acceptance

Release requires evidence on one immutable candidate for:

1. join-origin Family form submission creates an application-origin authenticated Parent session and lands in Parent Today;
2. the Parent can enter the protected classroom, open entitled protected video, and submit a Parent-scoped private question without any child account;
3. the Parent can create three child Students and the fourth-child attempt is rejected with no partial write;
4. Parent and child attendance, playback/progress, and questions remain separately attributed;
5. Rabbi Eli can switch between Admin and Parent and use Parent learning after post-migration provisioning;
6. the approved Parent welcome video, poster, and captions play through same-origin protected delivery with no Drive, storage, or provider locator exposed;
7. native PostgreSQL migration/readback, cross-household denial, replay, rollback, and provider-effect reconciliation all pass.

This decision authorizes repository implementation and the bounded release process. It does not by itself authorize a production database migration, asset upload/binding, account apply, provider send, or deployment; those remain separately approval-gated and reconciled.
