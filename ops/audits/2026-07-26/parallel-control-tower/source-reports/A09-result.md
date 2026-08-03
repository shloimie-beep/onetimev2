# A09 — Production versus staging UX and role-journey audit

**Audit ID:** A09  
**Audit date:** 2026-07-27  
**Commit-ready path:** `ops/audits/2026-07-26/parallel-control-tower/A09-result.md`  
**Repository:** `shloimie-beep/onetimev2`  
**Control checkpoint:** `e986b5e6502b1168b3eb28e200fd49ac8de46477`  
**Board-recorded accepted full-application source:** `a22009f4dce6bae6b0553ea9007ff40eceaffd25`  
**Current Git production-release source inspected:** `0d69de15e3c5e7a5e51f2b9262c992ea153c51fb`  
**Mode:** Read-only source, evidence, and public-route audit. No protected login, login-code request, form submission, provider call, deployment, branch, commit, PR, database write, or production mutation was performed.

## 1. Executive determination

**Overall status: `P1_ACTION_REQUIRED_PREPARATION_ONLY`.**

1. **CONFIRMED CURRENT TRUTH — production and persistent staging are intentionally different release lines.** The production-release source is a narrow Tisha B’Av line; the Board-recorded accepted source is the full One Time application. Missing Admin, Launch Status, Experience Preview, Parent, and Student functionality on the production-release source must not be diagnosed as random route breakage, and the full staging source must not be promoted wholesale without semantic preservation review.

2. **NEW FINDING — the Tisha B’Av public presentation has no accepted post-event disposition.** The event date in both inspected source lines is July 23, 2026, while the audit date is July 27. Both source lines still retain `registration_open: true`, and the production-release page source still renders the past date, **Reserve My Spot**, and the registration form. Whether the live endpoint currently accepts a registration is **UNPROVEN** because this audit did not submit a form. The next safe action is a public GET/readback plus an operator decision on closed, archive, replay, or redirect behavior—not an inferred implementation.

3. **NEW FINDING — accepted-source route evidence contains an unresolved legal-navigation defect on all four account-lifecycle pages.** The accepted route inventory records missing Privacy and Terms links on `/login`, `/activate`, `/forgot-password`, and `/reset-password` at 360×800, 390×844, tablet, and desktop. The pages themselves are real server-rendered lifecycle pages; this is not the obsolete static `login.html` placeholder.

4. **NEW FINDING — production’s public countdown is generated as fixed copy rather than current-day copy.** Fresh public root readback returned **“50 DAYS TO ROSH HASHANAH.”** The production-release client only hides the ticker at its deadline; it does not recompute the count. The accepted source recomputes the Jerusalem-calendar day count every minute. This is stale generated content, not proven browser-cache corruption.

5. **CONFIRMED CURRENT TRUTH — production still exposes the already-known website-assistant placeholder.** Fresh public root readback returned **“Offline readiness”** and **“The WhatsApp assistant is being connected.”** Accepted staging removes the helper entirely. This remains a semantic production-candidate acceptance item; a standalone production-only landing hotfix is not the default recommendation.

6. **NEW FINDING — the production Tisha line contains a newer route-specific social-card choice than the accepted staging source.** Accepted staging references `tisha-bav-social-card-v20260722.png`; the production-release source references `tisha-bav-whatsapp-card-v20260723.png`. A future semantic production candidate must adjudicate and preserve the production-only route metadata/asset choice rather than replacing the production tree with staging wholesale.

7. **CONFIRMED CURRENT TRUTH — accepted-source responsive, accessibility, provider-redaction, and sibling-isolation evidence is strong.** Existing accepted evidence reports no horizontal overflow, no critical/serious accessibility violations, no undersized targets in the sampled matrix, no raw provider URL exposure, and correct Parent/Student sibling isolation. That evidence is source acceptance, not fresh current-runtime proof.

8. **UNPROVEN — the exact current persistent-staging runtime and most current production subroutes were not independently read back in this audit.** The available public crawler returned the production root but did not provide reliable direct subroute or persistent-staging traversal. Failed crawler fetches are therefore not classified as 404s. Fresh `/version`, `/health`, `/ready`, public asset responses, protected-role rendering, and current staging route bodies remain missing evidence.

**Decision:** do not implement or promote from this audit. First assign a bounded readback lane and a Tisha post-event decision. Then assign only the confirmed source correction, preservation, and acceptance work.

---

## 2. Classification legend

| Classification | Meaning |
|---|---|
| **NEW FINDING** | A delta established by A09 that changes execution order, safety, release preservation, assignment, or acceptance. |
| **CONFIRMED CURRENT TRUTH** | Supported by the checkpoint Board, current Git source, accepted test/evidence artifacts, or fresh public root readback. |
| **SUPERSEDED/HISTORICAL** | Valid for an earlier source or fallback, but not current authority or current route behavior. |
| **UNPROVEN** | Plausible, previously asserted, or source-adjacent, but not established by acceptable fresh runtime proof. |

---

## 3. Audit method and boundaries

### 3.1 Inspected authority and prior work

**CONFIRMED CURRENT TRUTH**

- The complete `CURRENT.yaml` target and its `GOAL.md`, `SPEC.yaml`, `ACCEPTANCE.yaml`, `BOARD.yaml`, and `DECISIONS.yaml` were inspected at control checkpoint `e986b5e6502b1168b3eb28e200fd49ac8de46477`.
- A01, A02, A04, A05, and A06 were inspected before drawing conclusions. A09 does not relabel their settled control-plane, HighLevel, preservation, or security findings as new UX findings.
- PR #97 was treated as the conductor/control line. The checkpoint is a pointer and governance repair, not a deployed product source.
- PR #106 was treated as the current Git production-release line for source comparison, not as freshly verified production runtime identity.
- PR #118 and its integrated accepted source were inspected for the five-area Admin information architecture and role-preview contracts.

### 3.2 Read-only route inspection

**CONFIRMED CURRENT TRUTH**

- One fresh anonymous readback of the production root `/` was obtained.
- No form was submitted.
- No protected credential was used.
- No login code was requested.
- No Parent, Student, Admin, or Rabbi session was opened.
- No provider, database, deployment, or message state was changed.

### 3.3 Evidence limitations

**UNPROVEN**

- The audit did not freshly bind the persistent-staging origin to `/version` commit `a22009f4...`.
- The audit did not freshly bind the production origin to `/version` commit `0d69de15...`.
- Direct crawler failures for `/signup`, authentication routes, legal routes, `/tisha-bav`, and protected routes were not reliable enough to classify route status.
- Production and staging screenshots were not newly captured by this audit.
- Public image fallback text surfaced in crawler output is insufficient to prove an image request failed; asset status requires browser-network or direct HTTP evidence.

---

## 4. Source-of-truth map

| Layer | Exact source | Classification | A09 use |
|---|---|---|---|
| Control authority | `shloimie-beep/onetimev2@e986b5e6502b1168b3eb28e200fd49ac8de46477` | **CONFIRMED CURRENT TRUTH** | Status/assignment authority only; not UI source. |
| Accepted full application | `shloimie-beep/onetimev2@a22009f4dce6bae6b0553ea9007ff40eceaffd25` | **CONFIRMED CURRENT TRUTH** | Accepted source and persistent-staging evidence baseline. |
| Production-release Git line | `shloimie-beep/onetimev2@0d69de15e3c5e7a5e51f2b9262c992ea153c51fb` | **CONFIRMED CURRENT TRUTH** as Git source; **UNPROVEN** as exact current runtime | Narrow Tisha/public production source comparison. |
| Historical Board-recorded Tisha production | `acddcc8cd012c5cdc5bfc08cbc80550bef8719ba` | **SUPERSEDED/HISTORICAL** | Earlier production acceptance; not current Git release head. |
| Current public production root body | anonymous GET/readback of origin root on 2026-07-27 | **CONFIRMED CURRENT TRUTH** for returned body | Confirms helper copy, old landing hierarchy, and returned 50-day ticker text. |
| Current persistent-staging runtime | not freshly bound during A09 | **UNPROVEN** | Existing Board evidence retained; no new runtime claim. |

**CONFIRMED CURRENT TRUTH — exact ancestry:** the immutable comparison between the inspected production-release source and accepted full-application source has merge base `5ddd7b604c01744dd562050ae9b51124f7732594`; the accepted source contains 190 commits not in the production-release source, while the production-release source contains 36 commits not in the accepted source.

**CONFIRMED CURRENT TRUTH — semantic consequence:** the accepted full application and the current production-release line are divergent descendants, not a simple “staging is newer production” sequence. A production candidate requires a three-way preservation ledger, not a blind merge, force replacement, or route-by-route cherry-pick.

---

## 5. Finding register

| ID | Classification | Priority | Finding | Execution effect |
|---|---|---:|---|---|
| `A09-F01` | **NEW FINDING** | P1 | Both inspected source lines retain a pre-event/open Tisha presentation after the event date; live acceptance behavior is unproven. | Public readback and operator disposition precede any Tisha implementation or semantic candidate. |
| `A09-F02` | **NEW FINDING** | P1 | Accepted route evidence records missing Privacy/Terms navigation on all four account-lifecycle routes at every tested breakpoint. | Board assignment is required for a narrow presentation-only closure if fresh readback confirms the gap. |
| `A09-F03` | **NEW FINDING** | P2 | Production’s countdown is fixed generated copy; accepted source computes current Jerusalem-day copy. | Add dynamic-countdown truth to semantic production-candidate acceptance. |
| `A09-F04` | **NEW FINDING** | P1 preservation | Production has a newer Tisha social-card/metadata choice than accepted staging. | Preserve and adjudicate the production-only route asset before candidate convergence. |
| `A09-F05` | **CONFIRMED CURRENT TRUTH** | P1 | Production root still exposes the offline/being-connected assistant helper removed from accepted staging. | Preserve as a production-candidate blocker; do not create an unassigned hotfix. |
| `A09-F06` | **CONFIRMED CURRENT TRUTH** | — | Production release is a narrow public/Tisha line; accepted staging is the full role application. | Absence of protected routes in the production source is not by itself a dead-route defect. |
| `A09-F07` | **CONFIRMED CURRENT TRUTH** | — | `Contacts` intentionally maps to `/app/crm`; `Classroom` intentionally maps to `/app/classes`; Launch Status and Experience Preview are utilities. | Preserve labels and aliases; do not “correct” them into duplicate route families. |
| `A09-F08` | **CONFIRMED CURRENT TRUTH** | — | Accepted role evidence passes sampled responsive, accessibility, provider-redaction, and isolation gates. | Use it as the candidate baseline, while requiring fresh exact-SHA proof before release. |
| `A09-F09` | **UNPROVEN** | P1 acceptance gap | Current staging runtime identity, current production subroutes, asset freshness, and live role journeys were not freshly verified. | Assign evidence-only readback before implementation or release conclusions. |
| `A09-F10` | **SUPERSEDED/HISTORICAL** | — | Generated static `login.html` says the app slice is reserved. Server route handlers override it with real lifecycle pages. | Do not file a placeholder-login defect from the static build fallback. |

---

## 6. Public-route audit

### 6.1 Home `/`

**CONFIRMED CURRENT TRUTH — copy drift**

The publicly returned production root still presents the older hierarchy:

- worldwide-learning text as a kicker;
- `Give your son a love for learning Torah.` as the H1;
- the old public section ordering;
- the assistant helper.

The accepted source instead makes the worldwide-learning statement the H1, uses the love-of-learning line as supporting copy, places the countdown in the accepted flow, and removes the assistant helper.

**CONFIRMED CURRENT TRUTH — placeholder/helper drift**

Production returned:

- `Offline readiness`;
- `The WhatsApp assistant is being connected.`

Accepted source contains no public assistant surface. This is a provider-truthfulness and customer-experience defect already settled by A02; A09 preserves it as a production-candidate route check rather than inventing a new standalone lane.

**NEW FINDING — stale countdown semantics**

Production returned `50 DAYS TO ROSH HASHANAH`. The production-release client code hides the ticker at the deadline but never recalculates the rendered number. Accepted source derives the count from the current date in `Asia/Jerusalem` and updates it every minute. The defect is stale generated copy. A cache purge alone is not a sufficient fix unless exact source readback proves the runtime already contains the dynamic implementation.

**UNPROVEN — visual fit and asset freshness**

A text crawler cannot establish current horizontal overflow, image dimensions, LCP, CLS, or clipping. Existing accepted evidence is green; fresh production browser evidence is absent.

### 6.2 Signup `/signup`

**CONFIRMED CURRENT TRUTH — accepted contract**

Accepted source includes:

- Family/School selection;
- adult/contact fields only;
- explicit service-message language;
- optional email and WhatsApp reminders, unselected by default;
- Privacy, Terms, communication-consent, and student-data links;
- a no-JavaScript fallback;
- no raw Student-sensitive intake request.

Accepted route evidence reports no sampled overflow or accessibility violation at mobile, tablet, and desktop breakpoints.

**UNPROVEN — current runtime**

A09 did not submit or directly inspect the live production or current staging signup page. No conclusion is made about current submission success, GHL projection, confirmation delivery, or provider state.

### 6.3 Login and account lifecycle

Exact routes:

- `/login`
- `/activate`
- `/forgot-password`
- `/reset-password`

**CONFIRMED CURRENT TRUTH — real route implementation**

The server renders real lifecycle pages with CSRF state, `Cache-Control: no-store, private`, and `X-Robots-Tag: noindex, nofollow`. Existing integration tests cover login, activation, generic recovery response, password reset, session invalidation, and token replay denial.

**SUPERSEDED/HISTORICAL — static fallback copy**

The generated static `login.html` placeholder is not the live server route contract and must not be used as a defect basis.

**NEW FINDING — legal navigation**

The accepted route inventory explicitly records `privacy: false` and `terms: false` for all four lifecycle routes at 360×800, 390×844, tablet, and desktop. This gap is not closed by a zero-axe result. If fresh exact-source readback confirms it, the narrow source fix should add legal links without changing authentication APIs, token semantics, cookies, CSRF, session behavior, or no-store/noindex headers.

### 6.4 Privacy and Terms

Exact routes:

- `/privacy`
- `/terms`

**CONFIRMED CURRENT TRUTH — accepted source**

Accepted route evidence returns 200, canonical metadata, index/follow behavior, no sampled overflow, and no missing accessible names. Privacy includes the communication-consent and Parent/Guardian/Student data notices; Terms includes communication terms.

**UNPROVEN — current production and staging bodies**

A09 did not freshly read the complete legal pages. No assertion is made that current public text equals accepted source or current counsel policy.

### 6.5 Tisha B’Av `/tisha-bav`

**CONFIRMED CURRENT TRUTH — historical responsive acceptance**

The accepted Tisha route passed the required historical matrix at:

- 375×667;
- 390×844;
- 430×932;
- 1366×768;
- 1440×900.

Historical acceptance covered exact title/copy, `No charge`, responsive asset selection, viewport fit, visible CTA, modal close, success/share states, and intercepted registration POSTs.

**NEW FINDING — post-event presentation gap**

The source remains pre-event in four important respects after July 23:

- `registration_open` remains true in both inspected source configs;
- the page renders the past event date and time;
- the CTA remains `Reserve My Spot`;
- the registration form remains in the generated page.

The registration API’s current live behavior is **UNPROVEN**. A09 does not infer that it accepts or rejects the request. The operator must decide the desired post-event public state before code is assigned.

**NEW FINDING — production-only metadata preservation**

Accepted staging and production reference different social-card assets. This may be an intentional later production improvement. It must be included in the source-preservation ledger and tested through OG/Twitter metadata readback after any candidate build.

---

## 7. Protected Admin and role-journey audit

### 7.1 Production versus accepted application scope

**CONFIRMED CURRENT TRUTH**

The production-release source does not contain the accepted full Admin IA, Launch Status, Experience Preview, or Live Console client modules. It statically builds the older CRM/dashboard/classes/content/billing and Parent/Student shells. The accepted source contains the integrated full role application.

**Execution consequence:** do not file separate production route bugs for every absent protected surface. Their absence reflects the narrow production release line. They become candidate acceptance requirements only after the Board assigns the semantic production candidate.

### 7.2 Admin shell and exact navigation

**CONFIRMED CURRENT TRUTH — accepted contract**

The accepted primary Admin navigation is exactly:

1. `Dashboard` → `/app/dashboard`
2. `Contacts` → `/app/crm`
3. `Content` → `/app/content`
4. `Classroom` → `/app/classes`
5. `Live Console` → `/app/live-console`, only when the server capability is true

Utilities are separated from the primary areas:

- `Launch Status` → `/app/launch-status`
- `Experience Preview` → `/app/experience-preview`, only when its server capability is true
- `Support` → `/app/support`

**CONFIRMED CURRENT TRUTH — route aliases are intentional**

- `Contacts` using `/app/crm` is not a mismatch.
- `Classroom` using `/app/classes` is not a mismatch.
- legacy `Rewards` resolves under Classroom rather than creating a sixth primary area.
- Studio remains under Content rather than becoming a primary area.

**CONFIRMED CURRENT TRUTH — accepted shell accessibility**

The accepted AppShell includes:

- a skip link;
- a labeled mobile drawer button;
- `aria-expanded` and `aria-controls` state;
- Escape close;
- focus trapping;
- focus restoration;
- separate utility navigation;
- a session-expired state that clears protected content and requires sign-in.

### 7.3 Contacts `/app/crm`

**CONFIRMED CURRENT TRUTH — accepted contract**

Contacts is the adult/Parent CRM workspace. Existing accepted source capability-gates create/edit operations and preserves read-only roles. The UI distinguishes Contacts from local-only Students and household operations.

**UNPROVEN — current runtime**

A09 did not authenticate or inspect live list, detail, search, edit, archive, notes, tags, communications, conflict, empty, loading, or error states.

### 7.4 Content `/app/content`

**CONFIRMED CURRENT TRUTH — accepted contract**

Content owns library, factory, Studio, knowledge, and prompt workspaces. Accepted staging evidence covers protected synthetic content publication and sibling-scoped playback without raw provider URLs.

**UNPROVEN — current runtime**

No fresh source-bound browser readback was performed for content state, disabled controls, provider readiness, upload state, playback, or unpublish behavior.

### 7.5 Classroom `/app/classes`

**CONFIRMED CURRENT TRUTH — accepted contract**

Classroom focuses one occurrence at a time and owns schedule, questions, and rewards. The accepted route family preserves legacy Rewards under the Classroom category.

**UNPROVEN — current runtime**

No fresh class occurrence, control state, mobile clipping, or provider-ready state was inspected.

### 7.6 Live Console `/app/live-console`

**CONFIRMED CURRENT TRUTH — provider truthfulness contract**

Live Console is capability-gated. Accepted production-negative behavior hides or denies the surface when the capability is false. The accepted provider-off experience must not display raw Zoom URLs or claim real host control.

**UNPROVEN — current runtime**

A09 did not authenticate, open Live Console, or contact Zoom. Current production and staging control truth was not freshly rendered.

### 7.7 Launch Status `/app/launch-status`

**CONFIRMED CURRENT TRUTH — accepted contract**

Launch Status is a utility, not a sixth Admin area. It is Board-derived and must display the named milestone, completed/total acceptance count, percentage, what works, exact blockers, safe route links, and one next executable task from the exact Board source hash.

**UNPROVEN — current runtime**

The utility was not freshly opened or source-hash-read back in A09.

### 7.8 Experience Preview `/app/experience-preview`

**CONFIRMED CURRENT TRUTH — accepted contract**

Experience Preview is Admin-only, capability-gated, staging-only, and read-only. It exposes five exact fictional role choices and opens isolated no-opener, one-use, route-scoped role previews. It must fail closed in production and must not expose Admin navigation in Student preview tabs.

**CONFIRMED CURRENT TRUTH — accepted isolation evidence**

Existing evidence covers Parent, three Student siblings, Rabbi/Classroom, preserved Admin session, cross-sibling denial, and production gating.

**UNPROVEN — current runtime**

The current staging utility and its exact five role cards were not freshly opened in A09.

### 7.9 Parent `/app/parent`

**CONFIRMED CURRENT TRUTH — accepted information architecture**

Exact categories:

- Learners
- Classes & materials
- Progress & rewards
- Billing
- Updates

Accepted evidence reports no serious accessibility violations, no horizontal overflow, and no provider URL leakage at 360×800, 390×844, 768×1024, and 1440×1000.

**UNPROVEN — current runtime**

No current Parent session was opened. Household scope, paused state, billing wording, learner filtering, and current content were not freshly verified.

### 7.10 Student `/app/student`

**CONFIRMED CURRENT TRUTH — accepted information architecture**

Exact categories:

- Today
- Library
- Class Helper
- Progress
- Questions
- Updates

Accepted evidence reports correct sibling isolation, protected content opening, question behavior, session-expiry handling, provider URL guards, no serious accessibility violations, and no horizontal overflow at 360×800, 390×844, 768×1024, and 1440×1000.

**UNPROVEN — current runtime**

No current Student session was opened. Current lesson state, entitlement, provider-off state, questions, and sibling isolation were not freshly re-proven.

---

## 8. Requested category determinations

| Requested category | Determination |
|---|---|
| Copy drift | **CONFIRMED CURRENT TRUTH:** production home uses the older hierarchy and helper. **NEW FINDING:** production countdown is fixed generated copy. **NEW FINDING:** Tisha remains pre-event after the event date. |
| Placeholder/helper drift | **CONFIRMED CURRENT TRUTH:** production root still exposes offline/being-connected assistant copy; accepted source removes it. |
| Dead or unavailable controls | **UNPROVEN:** live Tisha CTA/API behavior was not exercised. **CONFIRMED CURRENT TRUTH:** protected surfaces absent from the narrow production source are intentional release-scope differences, not individually proven dead controls. |
| Route mismatch | **CONFIRMED CURRENT TRUTH:** Contacts→`/app/crm` and Classroom→`/app/classes` are intentional. Launch Status and Experience Preview are utilities. No reliable current-runtime 404 conclusion is available. |
| Mobile overflow/clipping | **CONFIRMED CURRENT TRUTH:** accepted evidence is green at the specified matrices. **UNPROVEN:** fresh production and current staging browser measurements are absent. |
| Accessibility gaps | **NEW FINDING:** legal navigation is absent on all four lifecycle routes in accepted inventory. **CONFIRMED CURRENT TRUTH:** sampled accepted pages otherwise report zero serious/critical violations and no undersized targets. |
| Provider truthfulness | **CONFIRMED CURRENT TRUTH:** production helper is not acceptable provider truth; accepted protected routes redact provider URLs and capability-gate provider surfaces. **UNPROVEN:** current runtime provider states were not opened. |
| Role leakage | **CONFIRMED CURRENT TRUTH:** accepted sibling and preview isolation evidence is green. **UNPROVEN:** no current production or staging protected session was opened by A09. |
| Stale assets/cache | **NEW FINDING:** fixed countdown is stale-source semantics, not proven cache corruption. **NEW FINDING:** route-specific Tisha social asset differs between production and accepted staging and requires preservation. **UNPROVEN:** current image HTTP status/cache headers were not freshly captured. |
| Missing evidence | **UNPROVEN:** exact `/version` bindings, current staging route bodies, production subroutes, public asset responses, current protected-role screenshots, and current no-store/cache readback. |

---

## 9. Exact route and breakpoint acceptance matrix

The matrix below is the minimum future acceptance set. “Accepted baseline” means evidence exists for the accepted source; it does not mean A09 freshly re-ran the route.

| Surface | Exact route(s) | Required breakpoints | Required acceptance | A09 current status |
|---|---|---|---|---|
| Home | `/` | 360×800; 390×844; 768×1024; 1366×768; 1440×900 | Accepted hero hierarchy; dynamic Jerusalem countdown; no assistant placeholder; no horizontal overflow; images 200/nonzero; keyboard/reduced-motion; CTA reaches `/signup`; canonical/OG exact. | Production body drift confirmed; fresh visual/network proof missing. |
| Signup | `/signup` | 360×800; 390×844; 768×1024; 1440×1000 | Adult/contact-only fields; optional channels default off; no-JS fallback; Privacy/Terms/consent links; no overflow; no serious a11y; no real submission in visual acceptance. | Accepted baseline exists; current runtime unproven. |
| Login | `/login` | 360×800; 390×844; 768×1024; 1440×1000 | Real form; Forgot password link; Privacy and Terms links; no-store/private; noindex/nofollow; keyboard/errors; no overflow; lifecycle semantics unchanged. | Legal links missing in accepted inventory; current runtime unproven. |
| Activation | `/activate` | 360×800; 390×844; 768×1024; 1440×1000 | Password setup states; Privacy and Terms links; token invalid/expired/consumed states; no-store/noindex; no overflow. | Legal links missing in accepted inventory; current runtime unproven. |
| Recovery | `/forgot-password`; `/reset-password` | 360×800; 390×844; 768×1024; 1440×1000 | Generic recovery response; password policy and token states; Privacy and Terms links; no-store/noindex; no overflow; no enumeration leak. | Legal links missing in accepted inventory; current runtime unproven. |
| Legal | `/privacy`; `/terms` | 360×800; 390×844; 768×1024; 1440×1000 | 200; canonical metadata; index/follow; complete headings; keyboard; no overflow; policy version/contact metadata present without private values. | Accepted baseline exists; current bodies unproven. |
| Tisha | `/tisha-bav` | 375×667; 390×844; 430×932; 1366×768; 1440×900 | **Blocked pending operator post-event decision.** Then exact closed/archive/replay/redirect copy, no stale reservation control, exact metadata/social card, no overflow, fresh assets, no unintended POST/provider action. | Source is pre-event/open; live behavior unproven. |
| Admin shell | `/app/dashboard` | 360×800; 390×844; 768×1024; 1440×1000 | Exactly five primary areas; utilities separate; hamburger/focus trap/skip link; no duplicate nav/card wall/BNA bridge copy; session-expired clearing. | Accepted baseline exists; production narrow source lacks full shell; current staging unproven. |
| Contacts | `/app/crm` | 360×800; 390×844; 768×1024; 1440×1000 | Contacts label preserved; capability-gated writes; search/detail/empty/loading/error/conflict; no URL PII; no Student leakage; no overflow/a11y regression. | Accepted source only; fresh runtime unproven. |
| Content | `/app/content` | 360×800; 390×844; 768×1024; 1440×1000 | Content owns Library/Factory/Studio/Knowledge/Prompts; truthful provider-off states; protected playback; no raw provider URL; no dead enabled control. | Accepted baseline exists; fresh runtime unproven. |
| Classroom | `/app/classes` | 360×800; 390×844; 768×1024; 1440×1000 | Classroom label preserved; one occurrence context; schedule/questions/rewards; legacy Rewards resolves safely; provider state truthful; no overflow. | Accepted source only; fresh runtime unproven. |
| Live Console | `/app/live-console` | 360×800; 390×844; 768×1024; 1440×1000 | Visible only with server capability; provider-off copy truthful; production-negative route/nav proof; no raw Zoom URL; no provider action in visual acceptance. | Accepted baseline exists; fresh runtime unproven. |
| Launch Status | `/app/launch-status` | 360×800; 390×844; 768×1024; 1440×1000 | Utility placement; exact Board hash; milestone counts/percentage; blockers; safe links; one next task; no editable duplicate status. | Accepted source contract exists; fresh source-hash readback missing. |
| Experience Preview | `/app/experience-preview` | 360×800; 390×844; 768×1024; 1440×1000 | Admin-only capability; five exact roles; read-only/no-opener one-use previews; production fails closed; no Admin controls in Student tabs; sibling isolation; originating Admin session preserved. | Accepted baseline exists; current staging unproven. |
| Parent | `/app/parent` | 360×800; 390×844; 768×1024; 1440×1000 | Exact five categories; one focused body; household/learner scope; paused state truthful; no sibling/provider leakage; no overflow/serious a11y. | Accepted baseline exists; fresh runtime unproven. |
| Student | `/app/student` | 360×800; 390×844; 768×1024; 1440×1000 | Exact six categories; only current sibling; approved content; entitlement and session-expiry states; private question scope; no provider URL; no overflow/serious a11y. | Accepted baseline exists; fresh runtime unproven. |

### 9.1 Header and cache acceptance

**CONFIRMED CURRENT TRUTH — required protected behavior**

For authentication and protected application pages:

- `Cache-Control: no-store, private`;
- no ETag/Last-Modified reuse for protected HTML;
- `X-Robots-Tag: noindex, nofollow` where applicable;
- no raw provider target in HTML, DOM, history, URL, or screenshot;
- versioned app assets or an exact asset-build binding.

### 9.2 Metadata acceptance

**CONFIRMED CURRENT TRUTH — required public behavior**

- `/`, `/signup`, `/privacy`, `/terms`, and the chosen post-event Tisha route state require exact canonical and OG metadata appropriate to their indexability.
- Authentication routes remain noindex/nofollow; absence of marketing OG metadata is not a defect.
- The production-only Tisha social-card choice must be explicitly accepted or superseded; it may not disappear as an accidental staging overwrite.

---

## 10. No-go conclusions

1. **CONFIRMED CURRENT TRUTH — do not call public crawler failures 404s.** Route status is unproven until a browser or HTTP client returns status and body from the exact origin.
2. **CONFIRMED CURRENT TRUTH — do not call the static login fallback the live login.** Server handlers own the lifecycle routes.
3. **CONFIRMED CURRENT TRUTH — do not classify production’s missing full-role routes as isolated dead-route bugs.** They are consequences of the narrow production release line.
4. **CONFIRMED CURRENT TRUTH — do not promote `a22009f4...` wholesale over production.** Preserve the production-only Tisha metadata/asset and adjudicate every unique path.
5. **CONFIRMED CURRENT TRUTH — do not create a landing-only hotfix by default.** Helper removal and dynamic countdown belong in the semantic production candidate unless the operator separately assigns an emergency narrow release.
6. **CONFIRMED CURRENT TRUTH — do not change Tisha post-event behavior without an operator decision.** Readback alone cannot choose archive, replay, waitlist, redirect, or closed copy.
7. **CONFIRMED CURRENT TRUTH — do not use a protected credential or request a code merely to fill A09 evidence.** Any later protected acceptance must use an assigned, approved synthetic/operator handoff and must remain redacted.

---

## 11. Recommended tasks

No task below is assigned by this report. Each requires an explicit Board assignment before its writer acts.

| Task | Dependency | Owner / writer slot | Exact write scope | Stop condition | Required proof | Board assignment? |
|---|---|---|---|---|---|:---:|
| `A09-T01` — exact production/staging route readback | Accepted A09 result; known public origins; no implementation dependency | `OT-CONTROL` evidence-only writer | Create one sanitized evidence packet only. Bind production and persistent staging through `/version`, `/health`, `/ready`; issue anonymous GET/HEAD only for public routes and assets; record status, redirect chain, cache/robots/canonical/OG headers, DOM text hashes, asset dimensions, and exact breakpoint screenshots. No forms, codes, protected login, or provider calls. | Any target is ambiguous; `/version` source mismatches the intended source; a route requires authentication; a request would POST, enroll, send, or reveal a protected value; staging cannot be safely distinguished from production. | Timestamped route matrix; exact full SHAs; redacted headers; public screenshots at all required breakpoints; asset HTTP 200/nonzero; no horizontal overflow/serious a11y; zero external effects. | YES |
| `A09-T02` — Tisha post-event disposition | `A09-T01` public `/tisha-bav` and registration-endpoint readback; operator business decision | `OT-CONTROL` decision writer; no product writer | Add only a sanitized `DECISIONS.yaml`/Board decision and handoff defining the post-event public state: closed, archive, replay, waitlist, or redirect; exact CTA/form visibility; registration API behavior; indexability; canonical/OG/social-card choice; and whether historical confirmation/share content remains. | Operator has not chosen the business state; current runtime already implements a different governed state; decision would require a provider workflow/send change; any private link or customer record would be rendered. | Signed/dated operator decision; exact route/API acceptance; explicit production-only asset preservation decision; provider/customer effect count fixed at zero. | YES |
| `A09-T03` — account-lifecycle legal-navigation closure | `A09-T01` confirms the links remain absent on the exact candidate; policy routes are current | `OT-PRODUCT` single source writer | Presentation-only change shared by `/login`, `/activate`, `/forgot-password`, and `/reset-password`: add accessible Privacy and Terms navigation. Do not alter authentication endpoints, token schemas, CSRF, cookies, sessions, password policy, MFA/email challenge, rate limits, or provider delivery. | Links are already present on the exact source; operator/counsel rejects the requirement; diff touches auth/domain/session code; any lifecycle test regresses. | Four routes × 360×800, 390×844, 768×1024, 1440×1000; keyboard/focus; zero serious axe findings; no overflow; exact no-store/noindex headers; all lifecycle unit/integration tests green; diff limited to shared presentation/tests. | YES |
| `A09-T04` — semantic production-candidate UX preservation ledger | `A09-T02`; `A09-T03` accepted or explicitly waived; A05 semantic adjudication; Board production-pilot prerequisites including the existing Zoom chain | `OT-PRODUCT` single candidate writer | Before code, create a path/blob/behavior ledger across merge base, `a22009f4...`, and the then-current production release. Preserve/adjudicate the production Tisha social metadata/asset; accepted full Admin/role source; landing hierarchy; dynamic countdown; helper removal; lifecycle legal links; post-event Tisha decision; migrations and provider gates. No deployment in the ledger phase. | Any unique production path is unclassified; production head advanced; migration lineage is ambiguous; another writer owns an overlapping route; Zoom/production-pilot dependency remains unaccepted; candidate would enable a provider or broad customer action. | Exact three-way ancestry; unique-file/blob table; route-level semantic decisions; migration/checksum inventory; candidate source plan; zero secret/protected-value findings; Board-approved candidate scope and stop conditions. | YES |
| `A09-T05` — exact candidate UX and role acceptance | Board-assigned exact candidate from `A09-T04`; exact isolated-staging deployment; approved redacted fictional/operator access handoff | `OT-CONTROL` independent evidence writer; no product writes | Run the full route/breakpoint matrix against the exact candidate. Public forms remain intercepted; protected journeys use approved isolated synthetic/operator identities; no provider-real mode, customer send, payment, production mutation, or raw protected value. Verify Admin five-area IA, utilities, capability-negative routes, Parent/Student isolation, no-store, metadata, assets, mobile fit, and stale-cache resistance. | Candidate SHA, deployment SHA, or database schema mismatch; provider-real gate enabled; protected handoff cannot be used without exposure; any route requires an external effect; production target is selected. | `/version` exact SHA; `/health` and `/ready`; route screenshots/traces; axe/no-overflow/target-size results; cache/robots/metadata readback; role/capability/sibling/provider negative tests; source and evidence hashes; zero external effects. | YES |

---

## 12. Required execution order

1. **Assign and complete `A09-T01`.** Establish exact current runtime truth without authentication or mutation.
2. **Assign `A09-T02`.** Make the Tisha post-event product decision from fresh readback.
3. **Assign `A09-T03` only if the exact candidate still lacks lifecycle legal navigation.** Do not pre-author a patch against stale source.
4. **Complete A05 semantic adjudication and the existing Zoom/production-pilot prerequisites.** A09 does not supersede those dependencies.
5. **Assign `A09-T04` to one `OT-PRODUCT` writer.** Produce the preservation ledger and exact candidate scope before implementation.
6. **After an exact isolated-staging candidate exists, assign `A09-T05`.** No production promotion is authorized by A09.

Parallelism is limited:

- `A09-T01` can run while unrelated provider cleanup continues because it is public/read-only.
- `A09-T02` begins only after `A09-T01` returns Tisha truth.
- `A09-T03` may be prepared after confirmation, but it must not overlap the same files with `A09-T04`.
- `A09-T04` is a single-writer candidate lane.
- `A09-T05` is independent acceptance after the candidate is immutable.

---

## 13. Future OT-PRODUCT prompt

**Status: FUTURE — DO NOT RUN UNTIL `A09-T01`, `A09-T02`, the applicable result of `A09-T03`, A05 semantic adjudication, and the Board’s production-pilot prerequisites are accepted and the Board assigns one `OT-PRODUCT` writer.**

```text
OT-PRODUCT — One Time semantic production-candidate UX convergence

AUTHORITY AND START CONDITIONS

Repository: shloimie-beep/onetimev2
Control checkpoint for audit provenance:
e986b5e6502b1168b3eb28e200fd49ac8de46477
Accepted full-application source inspected by A09:
a22009f4dce6bae6b0553ea9007ff40eceaffd25
Production-release source inspected by A09:
0d69de15e3c5e7a5e51f2b9262c992ea153c51fb

This is a FUTURE prompt. Do not start unless BOARD.yaml explicitly assigns this
exact task to the OT-PRODUCT writer and records:

- accepted A09-T01 exact production/staging readback;
- accepted A09-T02 post-event Tisha decision;
- accepted A09-T03 result or an explicit waiver because links are already live;
- accepted A05 semantic adjudication for the production release line;
- accepted production-pilot prerequisites, including the existing Zoom chain;
- the then-current exact production release head and accepted staging head;
- an isolated-staging target and PRODUCTION_DEPLOY_AUTHORIZED=NO.

OBJECTIVE

Create one semantic production candidate that preserves valid production-only
work while converging to the accepted full One Time role application. Do not
merge or replace either tree wholesale.

MANDATORY FIRST OUTPUT — NO CODE YET

Produce a three-way path/blob/behavior ledger across:

1. the merge base;
2. the accepted full-application source;
3. the then-current production release source.

For every unique route, asset, migration, metadata file, and client/server
behavior, classify it as PRESERVE, PORT, SUPERSEDE, REJECT, or OPERATOR_DECISION.
Stop before code if any production-only item is unclassified.

REQUIRED SEMANTIC OUTCOMES

Public home:
- accepted hero hierarchy;
- current Jerusalem-day countdown rather than fixed build-time day copy;
- no Offline readiness / being-connected public assistant helper;
- no horizontal overflow or clipped media;
- exact canonical/OG metadata and fresh nonzero assets.

Signup:
- preserve adult/contact-only fields, separate optional reminder choices,
  no-JavaScript fallback, legal/consent links, and zero default optional consent;
- do not submit a live form during visual acceptance.

Account lifecycle:
- preserve real server-rendered /login, /activate, /forgot-password, and
  /reset-password behavior, no-store/private and noindex/nofollow;
- add accessible Privacy and Terms navigation only if A09-T03 is assigned;
- do not alter token, CSRF, cookie, session, email challenge, password, or rate
  limit semantics outside a separately assigned security task.

Tisha:
- implement exactly the accepted A09-T02 post-event state;
- preserve or explicitly supersede the production-only
  tisha-bav-whatsapp-card-v20260723.png metadata/asset choice;
- do not re-open registration, send a confirmation, enroll a workflow, expose a
  private join destination, or contact a provider;
- preserve historical evidence without presenting stale pre-event controls.

Administrator:
- exactly five primary areas:
  Dashboard, Contacts, Content, Classroom, Live Console;
- Contacts remains /app/crm;
- Classroom remains /app/classes;
- Studio remains under Content;
- Rewards remains under Classroom;
- Launch Status and Experience Preview remain utilities;
- Live Console and Experience Preview remain server-capability-gated;
- production-negative behavior must contain no card, nav item, or dead link.

Parent and Student:
- preserve exact accepted category labels and one focused workspace body;
- preserve household, learner, sibling, entitlement, approved-content,
  private-question, session-expiry, and provider-redaction boundaries;
- do not expose Admin controls or raw provider URLs.

PROHIBITED SCOPE

- no provider configuration or provider-real call;
- no GHL action, workflow activation, contact enrollment, or customer send;
- no Zoom/Vimeo/Telegram/WhatsApp/Stripe mutation;
- no production deployment;
- no real form submission;
- no protected value in source, logs, screenshots, PR text, or evidence;
- no new route family, duplicate shell, duplicate status ledger, or blind merge;
- no unrelated migration, auth-domain, billing, or communications rewrite.

EXACT ACCEPTANCE MATRIX

Home:
360x800, 390x844, 768x1024, 1366x768, 1440x900

Signup, auth, legal, and protected-role routes:
360x800, 390x844, 768x1024, 1440x1000

Tisha:
375x667, 390x844, 430x932, 1366x768, 1440x900

Routes:
/
/signup
/login
/activate
/forgot-password
/reset-password
/privacy
/terms
/tisha-bav
/app/dashboard
/app/crm
/app/content
/app/classes
/app/live-console
/app/launch-status
/app/experience-preview
/app/parent
/app/student

For the exact isolated-staging candidate prove:

- /version equals the full candidate SHA;
- /health and /ready are healthy at the exact migration set;
- no horizontal page overflow or clipped primary control;
- no serious/critical accessibility finding and no undersized target;
- keyboard navigation, focus restoration, and reduced-motion behavior;
- exact canonical/robots/cache/OG behavior;
- fresh asset HTTP 200, dimensions, and content hashes;
- no stale fixed countdown after clock-bound tests;
- capability-negative Live Console and Experience Preview behavior;
- exactly five Admin primary areas and separated utilities;
- Parent/Student sibling isolation and no role leakage;
- no raw provider URL in HTML, DOM, URL, history, logs, or screenshots;
- intercepted public POSTs and zero provider/customer/production effects.

STOP CONDITIONS

Stop and return a blocker without implementation or deployment when:

- BOARD assignment is absent or source heads differ from the assignment;
- a unique production file or asset lacks a preservation decision;
- the Tisha post-event decision is missing or ambiguous;
- migration ancestry/checksums are ambiguous;
- another writer owns an overlapping route or shared shell;
- any provider-real, send, payment, enrollment, or production gate is enabled;
- exact isolated-staging source cannot be proven through /version;
- a protected value would be rendered.

RETURN

Return a complete commit-ready report with exact commits, ancestry, changed
files, semantic preservation decisions, tests, screenshots/evidence paths,
external-effect counts fixed at zero, unresolved operator decisions, and a
CONTROL-TOWER-RETURN block. Do not promote production.
```

---

## 14. Source list

### 14.1 Audit input

- Uploaded A09 brief: `A09-production-versus-staging-ux-and-role-journey-audit.md`.

### 14.2 Control authority at `e986b5e6502b1168b3eb28e200fd49ac8de46477`

- `ops/goals/CURRENT.yaml`
- `ops/goals/OT-LAUNCH-01/GOAL.md`
- `ops/goals/OT-LAUNCH-01/SPEC.yaml`
- `ops/goals/OT-LAUNCH-01/ACCEPTANCE.yaml`
- `ops/goals/OT-LAUNCH-01/BOARD.yaml`
- `ops/goals/OT-LAUNCH-01/DECISIONS.yaml`

### 14.3 Accepted full-application source `a22009f4dce6bae6b0553ea9007ff40eceaffd25`

- `scripts/build-public-pages.ts`
- `apps/web/src/client/public/public-entry.ts`
- `apps/web/src/server/app.ts`
- `apps/web/src/client/app/admin-ia.ts`
- `apps/web/src/client/app/crm-entry.tsx`
- `apps/web/src/client/app/shell/AppShell.tsx`
- `config/events/tisha-bav-2026.json`
- `tests/integration/accounts/account-lifecycle-web.test.ts`
- `tests/e2e/w12-100/route-journey-inventory.spec.ts`
- `ops/evidence/w12-100/ROUTE-JOURNEY-INVENTORY.json`
- `ops/evidence/ot-81/responsive-accessibility-matrix.json`
- `ops/evidence/ot-83r/BROWSER-A11Y-PERFORMANCE.json`
- `ops/evidence/ot-83r/REAL-APP-JOURNEYS.json`
- Admin IA, Tisha, persistent-staging, and role-journey evidence recorded in `BOARD.yaml`.

### 14.4 Production-release source `0d69de15e3c5e7a5e51f2b9262c992ea153c51fb`

- `scripts/build-public-pages.ts`
- `apps/web/src/client/public/public-entry.ts`
- `apps/web/src/server/app.ts`
- `config/events/tisha-bav-2026.json`
- PR #106 changed-file inventory and source metadata.

### 14.5 Prior audit preservation

- `A01-result.md`
- `A02-controlled-production-pilot-gap-audit-result.md`
- `A04-result.md`
- `A05-result.md`
- `A06-result.md`

### 14.6 Fresh public evidence

- Anonymous production root readback on 2026-07-27 from `join.onetimeonetime.com`, route `/`.
- Observed body included the old landing hierarchy, assistant helper, and 50-day ticker.
- No protected route, form, code, provider, or mutation was used.

---

## 15. Final verdict

**P1 action is required, but implementation is not yet the next safe step.**

The first two moves are evidence and decision:

1. bind current production and persistent staging to exact runtime SHAs and complete the anonymous route/asset matrix;
2. decide the Tisha post-event public state.

After that, the only direct source correction presently supported is a narrow, Board-assigned lifecycle legal-navigation closure if the exact runtime still lacks those links. The broader production UX work belongs in one later semantic candidate that preserves the newer production Tisha metadata while converging to the accepted full application. Current accepted role evidence is strong, but it must be re-run against the exact candidate before any promotion.

No repository, deployment, provider, form, login, customer, or production change was made by A09.

```yaml
CONTROL-TOWER-RETURN
audit_id: A09
audit_title: Production versus staging UX and role-journey audit
result_path: ops/audits/2026-07-26/parallel-control-tower/A09-result.md
audit_date: 2026-07-27
mode: read_only
repository: shloimie-beep/onetimev2
control_checkpoint: e986b5e6502b1168b3eb28e200fd49ac8de46477
accepted_full_application_source: a22009f4dce6bae6b0553ea9007ff40eceaffd25
production_release_source_inspected: 0d69de15e3c5e7a5e51f2b9262c992ea153c51fb
production_runtime_sha_freshly_verified: false
persistent_staging_runtime_sha_freshly_verified: false
overall_status: P1_ACTION_REQUIRED_PREPARATION_ONLY
new_findings:
  - A09-F01-post-event-tisha-disposition-missing
  - A09-F02-auth-lifecycle-privacy-terms-links-missing
  - A09-F03-production-countdown-fixed-stale-copy
  - A09-F04-production-only-tisha-social-asset-preservation
confirmed_current_truth:
  - production-home-assistant-placeholder-remains
  - production-release-is-narrow-not-full-role-app
  - accepted-admin-five-area-ia-and-utility-routes
  - accepted-parent-student-a11y-overflow-isolation-provider-redaction
unproven:
  - exact-current-production-runtime-source
  - exact-current-persistent-staging-runtime-source
  - current-production-subroute-status
  - current-live-tisha-registration-endpoint-behavior
  - current-protected-role-rendering-and-role-leakage
  - current-public-asset-and-cache-readback
board_assignments_required:
  - A09-T01
  - A09-T02
  - A09-T03-if-confirmed
  - A09-T04
  - A09-T05
implementation_authorized_by_a09: false
production_promotion_authorized: false
protected_login_performed: false
login_code_requested: false
forms_submitted: false
provider_actions_performed: false
customer_messages_sent: false
repository_changes_performed: false
next_safe_action: >
  Assign A09-T01 as an evidence-only exact-SHA public/runtime readback, then
  assign A09-T02 for the operator's post-event Tisha decision. Do not patch,
  merge, deploy, submit, authenticate, or promote from this audit.
END-CONTROL-TOWER-RETURN
```
