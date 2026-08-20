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

## Route convergence map

The protected portal keeps canonical direct URLs and their existing mounted route
handlers. The shell title remains **Parent Portal** or **Student Portal** while the
category and subcategory determine the active rail and contextual strip.

| Role    | Current paths                                                                                                               | Before navigation                       | After category / subcategory                   | Handler and disposition                                       |
| ------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| Parent  | `/app/parent`                                                                                                               | mixed portal overview                   | Today                                          | Parent learning overview; retained                            |
| Parent  | `/app/parent/classroom`, `/app/parent/library`, `/app/parent/questions`                                                     | top-level legacy links                  | Learning / Classroom, Library, Questions       | existing Parent learning views; retained                      |
| Parent  | `/app/parent/progress`                                                                                                      | top-level Progress                      | Learning / Progress (Parent learner)           | existing summary handler; retained                            |
| Parent  | `/app/parent/calendar`, `/app/parent/classes/:occurrenceId`                                                                 | top-level Calendar                      | Learning / Classroom                           | existing schedule/detail handlers; retained                   |
| Parent  | `/app/parent/students`, `/app/parent/students/new`, `/app/parent/students/:studentId`                                       | top-level Students                      | Family / Students                              | existing household handlers; retained                         |
| Parent  | `/app/parent/progress?scope=students`, `/app/parent/progress/:studentId`                                                    | top-level Progress                      | Family / Student Progress                      | existing scoped summary handler; retained                     |
| Parent  | `/app/parent/updates`, `/app/parent/newsletter`                                                                             | top-level Updates                       | Updates                                        | existing update handlers; retained                            |
| Parent  | `/app/parent/account?tab=profile`, `/app/parent/account?tab=security`                                                       | Account                                 | Account / Profile, Sign-in & Security          | protected account composition; retained                       |
| Parent  | `/app/parent/privacy`, `/app/parent/data-rights`                                                                            | Account                                 | Account / Privacy                              | existing privacy handlers; retained                           |
| Parent  | `/app/parent/billing`                                                                                                       | top-level Billing                       | Account / Billing, capability-gated            | existing billing handler; hidden when disabled                |
| Parent  | `/app/parent/preferences`                                                                                                   | top-level Preferences                   | Account / Preferences                          | existing preference handler; retained                         |
| Parent  | `/app/parent/support`, `/app/parent/support/:ticketId`                                                                      | top-level Support                       | Account support recovery path                  | existing Parent-only support handler; retained                |
| Student | `/app/student`                                                                                                              | Today                                   | Today                                          | existing Student today handler; retained                      |
| Student | `/app/student/calendar`, `/app/student/classes/:occurrenceId`, `/app/student/class/:occurrenceId`                           | Calendar / classroom top-level links    | Learning / Classroom                           | existing Student schedule/classroom handlers; retained        |
| Student | `/app/student/library`, `/app/student/library/:contentId`                                                                   | Library, including generic query alias  | Learning / Library                             | direct library handler retained; generic alias removed        |
| Student | `/app/student/progress`                                                                                                     | top-level Progress                      | Learning / Progress                            | existing Student progress handler; retained                   |
| Student | `/app/student/questions`, `/app/student/questions/new`, `/app/student/questions/:questionId`                                | top-level Questions                     | Learning / Questions                           | Rabbi-only question handler; exact semantic aliases retained  |
| Student | `/app/student/updates`, `/app/student/notifications`                                                                        | Updates / Notifications top-level links | Updates                                        | existing Student-scoped handlers; retained                    |
| Student | `/app/student/account?tab=profile`, `/app/student/account?tab=security`, `/app/student/privacy`, `/app/student/data-rights` | Account                                 | Account / Profile, Sign-in & Security, Privacy | existing protected account/privacy handlers; retained         |
| Student | `/app/student/support`, `/app/student/support/:ticketId`                                                                    | direct technical-support submission     | Account-safe Parent handoff                    | retained safe explanatory view; Student submission is removed |

The compatibility path `/app/student?section=library` is removed because it can
mount the legacy portal and lose direct-link selection. Question creation/detail
aliases remain because they compose the exact private Questions view without a
second shell. No Parent compatibility alias is introduced.
