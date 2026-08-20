# Design

## Protected-shell resolution

The portal resolves the signed-in session and its exact role before composing a
Parent or Student shell. A loading shell retains One Time identity, stable geometry,
and the requested role boundary; it does not render legacy, Admin, or opposite-role
navigation. Ready state is indicated only after the role's required dashboard data
has resolved. Errors retain the same role-safe shell and disclose no household data.

## Navigation

Desktop uses a single primary category rail. Parent order is Today, Learning,
Family, Updates, Account. Student order is Today, Learning, Updates, Account.
Learning tabs are Classroom, Library, Progress, Questions. Parent Family tabs are
Students and Student Progress. Account tabs are Profile, Sign-in & Security,
Privacy, then capability-gated Billing and Preferences for Parents.

Mobile replaces the rail with one branded focus-trapped drawer. The drawer locks
body scroll, closes on Escape and predictable outside interaction, returns focus to
its opener, and has 44px minimum interactive targets. Context tabs form one
horizontally scrolling, keyboard-accessible strip below the page title.

## Truth and boundaries

Student navigation never exposes household data, Billing, or technical-support
submission. Parent Billing is only shown when the existing capability says it is
available. Normal Library empty state says that migration is in progress; the W12
fixture may show only its isolated synthetic recording and review sheet.
