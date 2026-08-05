# One Time Mishnayos — Screen Catalog and Design System

**Package:** `ONE-TIME-PRODUCTION-SPEC-v2.1`  
**Document:** `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`  
**Status:** Normative production specification  
**Version:** 2.1  
**Date:** 2026-07-28  
**Repository:** `shloimie-beep/onetimev2`  
**Reviewed head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`

## UI-001. Scope and package relationships

This document defines every production screen family, visual token, responsive rule, accessibility requirement, shared component, interaction state, and role-specific presentation rule.

It implements `03-DECISION-REGISTER-v2.1.md` and is read with:

- product behavior: `01-PRODUCT-SPEC-v2.1.md`;
- actor, capability, and canonical routes: `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md`;
- entity lifecycle and transition truth: `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md`;
- workflow, notification, and canonical copy: `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`;
- privacy, consent, and child-data presentation: `10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`;
- acceptance evidence: `02-ACCEPTANCE-CONTRACT-v2.1.yaml`;
- requirement traceability: `14-TRACEABILITY-CROSSWALK-v2.1.yaml`.

Route IDs in this document refer to `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md`. State names refer to `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md`. User-facing text uses the canonical message entries in `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`; screen implementations may not invent conflicting copy.

## UI-002. Experience principles

The production experience follows these rules:

1. **Real work first.** Every visible action changes or reads persistent production data. There are no demos, fake cards, test lanes, or decorative controls.
2. **Today before totals.** The next class, current exception, or next required action appears before secondary metrics.
3. **One clear primary action.** Each page has no more than one visually dominant action for the current state.
4. **Role clarity.** Parent, Student, and Admin shells never mix navigation or imply capabilities the role does not have.
5. **Child-appropriate Student UI.** Student tasks use short language, large targets, obvious status, and minimal navigation depth.
6. **Protected-provider abstraction.** Zoom and Vimeo are experienced through authorized One Time surfaces. Raw provider destinations and IDs do not appear.
7. **Accessible equivalence.** Color, sound, animation, pointer gestures, and calendar grids always have a non-color, non-audio, reduced-motion, keyboard, and list-based equivalent.
8. **Recovery is part of the screen.** Empty, error, conflict, offline, session-expired, provider-unavailable, and retry states give a safe next action.
9. **English launch.** Interface and generated materials are English. Names accept Unicode. A Hebrew-name value may render with local RTL direction without changing the LTR application shell.
10. **Deferred means absent.** A deferred capability has no route, placeholder, disabled teaser, or “coming soon” card.

## UI-003. Brand and color tokens

### UI-003.1 Core palette

| Token | Value | Required use |
|---|---|---|
| `color.brand.black` | `#090909` | Primary shell/background |
| `color.brand.yellow` | `#FFD400` | Primary action, active emphasis |
| `color.brand.yellowHover` | `#E6BF00` | Primary action hover |
| `color.brand.cyan` | `#67E8F9` | Focus, informational accent, restrained highlights |
| `color.brand.white` | `#FFFFFF` | Primary dark-surface text |
| `color.surface.raised` | `#151515` | Raised dark surface |
| `color.surface.overlay` | `#202020` | Dialog/drawer surface |
| `color.surface.light` | `#FFFFFF` | Reading, form, transcript, worksheet surface |
| `color.surface.lightMuted` | `#F5F5F2` | Secondary light surface |
| `color.border.dark` | `#3B3B3B` | Dark-surface border |
| `color.border.light` | `#D4D4CF` | Light-surface border |
| `color.text.onDark` | `#FFFFFF` | Primary dark-surface text |
| `color.text.mutedOnDark` | `#B8B8B8` | Secondary dark-surface text |
| `color.text.onLight` | `#111111` | Primary light-surface text |
| `color.text.mutedOnLight` | `#565656` | Secondary light-surface text |
| `color.status.success` | `#5CE18A` | Success state with text/icon |
| `color.status.warning` | `#FFD166` | Warning state with text/icon |
| `color.status.danger` | `#FF6B6B` | Error/destructive state with text/icon |
| `color.status.info` | `#67E8F9` | Informational state with text/icon |
| `color.focus` | `#67E8F9` | Keyboard focus ring |

Primary yellow controls use `color.brand.black` text. Yellow controls never use white text. Cyan is limited to focus, informational state, links, and small accents; it is not a second primary-action color.

Status is never conveyed by color alone. Every state includes a text label and, where compact, a distinct icon.

### UI-003.2 Logo and brand separation

- Use the approved One Time logo asset only.
- The clear-space minimum is the height of the logo’s “O” on all sides.
- The minimum rendered wordmark width is 112 CSS pixels.
- On a dark shell, use the approved light/yellow mark; on a light surface, use the approved dark mark.
- Do not recolor the logo beyond approved variants.
- No BNA name, logo, color token, navigation label, cross-workspace switcher, or visual motif appears.
- Provider logos may appear only where they clarify a governed integration or hosted billing action; they never displace One Time branding.

## UI-004. Typography, spacing, shape, and iconography

### UI-004.1 Typography

The interface type family is:

`Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

| Token | Size/line height | Weight | Use |
|---|---|---|---|
| `type.display` | `40/48px` | 750 | Public hero only |
| `type.h1` | `32/40px` | 700 | Page title |
| `type.h2` | `24/32px` | 700 | Major section |
| `type.h3` | `20/28px` | 650 | Card/panel heading |
| `type.bodyLg` | `18/28px` | 450 | Student primary copy/public lead |
| `type.body` | `16/24px` | 450 | Default text/form |
| `type.bodySm` | `14/20px` | 450 | Secondary metadata |
| `type.label` | `14/20px` | 650 | Field/control labels |
| `type.caption` | `12/16px` | 550 | Nonessential compact metadata |

No required information uses text smaller than 12 CSS pixels. Student primary tasks use at least `type.bodyLg`. Text remains readable at 200% browser text zoom without clipping.

### UI-004.2 Spacing and layout

The base spacing unit is 4 CSS pixels.

| Token | Value |
|---|---:|
| `space.1` | `4px` |
| `space.2` | `8px` |
| `space.3` | `12px` |
| `space.4` | `16px` |
| `space.5` | `20px` |
| `space.6` | `24px` |
| `space.8` | `32px` |
| `space.10` | `40px` |
| `space.12` | `48px` |
| `space.16` | `64px` |

The authenticated desktop content maximum is 1440 CSS pixels. Reading and form columns are limited to 720 CSS pixels. Dense Admin lists may use the full content width.

### UI-004.3 Shape and depth

| Token | Value | Use |
|---|---:|---|
| `radius.sm` | `6px` | Chips, compact controls |
| `radius.md` | `10px` | Inputs, buttons |
| `radius.lg` | `14px` | Cards, panels |
| `radius.xl` | `20px` | Hero/major modal |
| `shadow.raised` | `0 8px 24px rgba(0,0,0,.24)` | Raised panels |
| `shadow.overlay` | `0 16px 48px rgba(0,0,0,.40)` | Dialogs/drawers |

Depth is used to clarify hierarchy, not to create a wall of floating cards.

### UI-004.4 Icons

- Use one outlined icon family with a consistent 2px visual stroke.
- Default icon sizes are 16, 20, and 24 CSS pixels.
- Icons accompanying text are decorative unless they add information.
- Icon-only buttons require an accessible name and visible tooltip on pointer/keyboard focus.
- Do not use emoji as operational status icons.

## UI-005. Responsive and browser contract

### UI-005.1 Breakpoints

| Name | Width | Behavior |
|---|---:|---|
| `mobile` | `0–639px` | Single column, drawer navigation, agenda calendar |
| `large-mobile` | `640–767px` | Single/two-column where safe |
| `tablet` | `768–1023px` | Full Parent/Student and full Admin mutation support |
| `desktop` | `1024–1279px` | Fixed sidebar and full workspace |
| `wide` | `1280px+` | Full workspace with optional details rail |

Supported production browsers are the current and immediately preceding major versions of:

- Chrome desktop and Android;
- Safari desktop and iPadOS;
- Microsoft Edge desktop.

### UI-005.2 Role support by viewport

Parent and Student workflows are fully supported from 360 CSS pixels through wide desktop, in portrait and landscape.

Admin:

- desktop and tablet support every mutation;
- mobile supports dashboard status, global search, class/live controls, ticket reply/status, provider status, session reset, and simple field edits;
- recurrence construction, bulk reconciliation, transcript/worksheet editing, dense audit exploration, and integration configuration show a noninteractive explanatory notice directing the Admin to tablet/desktop;
- unsupported dense controls are absent on mobile rather than rendered as nonworking controls.

No page creates viewport-level horizontal scrolling. A wide table may use a labeled, keyboard-operable contained scroll region or switch to stacked record cards.

### UI-005.3 Student device priorities

On Student tablet/mobile:

- Today loads the next actionable class above the fold;
- Join Class is at least 48 CSS pixels high;
- the embedded classroom uses the largest available safe viewport;
- browser chrome, keyboard, and rotation do not obscure leave, reconnect, support, or permission guidance;
- Zoom app installation is not required for the normal embedded flow;
- a provider/browser failure returns to the Student class state without losing the session.

## UI-006. Accessibility contract

All public and authenticated One Time screens conform to WCAG 2.2 Level AA.

### UI-006.1 Keyboard and focus

- All functionality is keyboard-operable.
- A visible “Skip to main content” link is the first focusable item.
- Focus order follows reading and action order.
- Focus indicators use a 3px `color.focus` ring with 2px offset.
- Opening a modal/drawer moves focus into it, traps focus, and returns focus to the opener on close.
- Route changes move focus to the page heading unless preserving focus is necessary for an inline update.
- No keyboard trap exists in calendar, media player, upload, table, embedded classroom, or provider-hosted handoff.

### UI-006.2 Semantics and screen readers

- Every page has one `h1` and a valid heading hierarchy.
- Landmarks identify header, navigation, main, complementary, and footer regions.
- Forms use persistent labels, instructions, `autocomplete`, and programmatic error association.
- Validation shows a focusable error summary and inline field errors.
- Tables use headers and captions; card alternatives preserve labels.
- Calendar has an equivalent agenda/list and announces selected date and event count.
- Status changes use polite live regions; urgent destructive or class-ending status may use assertive announcement.
- Loading skeletons are hidden from assistive technology and expose a concise loading label.
- Names containing Hebrew characters use local `dir="auto"` or `dir="rtl"` while the page remains `lang="en"` and LTR.

### UI-006.3 Visual, motion, sound, and touch

- Normal text contrast is at least 4.5:1; large text and component boundaries meet applicable 3:1 requirements.
- Text reflows at 400% zoom/320 CSS pixels without loss, except a bounded two-dimensional data region.
- Primary Student and all touch-critical controls are at least 44×44 CSS pixels; Join Class is at least 48px high.
- No required action depends on hover, drag alone, color alone, motion, or sound.
- `prefers-reduced-motion` removes nonessential animation and uses instant/short fades no longer than 100ms.
- The optional Student audible notification cue is off until deliberately enabled, has a visual equivalent, respects device/browser audio rules, and can be muted from Notifications.
- Countdown text is not placed in a frequently updating live region.

### UI-006.4 Media accessibility

Published recordings include:

- keyboard-operable controls;
- visible focus;
- captions;
- English transcript;
- playback-rate control;
- volume/mute;
- elapsed/remaining time;
- accessible error and retry state.

Generated captions and transcript remain drafts until Admin approval. Worksheets and review material use selectable text and semantic headings when delivered as HTML or accessible document output.

## UI-007. Shared application shell

### UI-007.1 Desktop/tablet shell

The authenticated shell contains:

- stable left navigation;
- One Time logo;
- page title and optional breadcrumbs;
- role/home context;
- Admin global search or Student notification entry where applicable;
- household switcher for an eligible Parent;
- account menu;
- persistent high-priority notice region;
- main content workspace.

The desktop sidebar is 256 CSS pixels wide. At tablet width it may collapse to icons plus labels on expansion, but all labels remain discoverable.

### UI-007.2 Mobile shell

Mobile uses:

- compact top bar with logo, page title, and menu button;
- focus-managed drawer for complete role navigation;
- no more than one sticky bottom primary action;
- optional Student bottom navigation for Today, Calendar, Library, Questions, and More;
- safe-area padding on devices with display cutouts.

### UI-007.3 Persistent notices

The notice region is reserved for:

- access/grace/inactive status;
- class canceled/rescheduled;
- provider degradation affecting the current task;
- unsaved conflict;
- session-expiry recovery.

Notices are ordered by severity and deduplicated. Dismissal is allowed only when the underlying event is informational; access and current operational failures remain visible until resolved.

## UI-008. Shared interaction states

Every applicable data surface implements the following states. A screen does not render irrelevant provider/conflict states merely to satisfy a checklist.

| State | Required presentation | Required action |
|---|---|---|
| Initial loading | Stable skeleton matching final layout; concise accessible loading label | None |
| Background refresh | Existing data remains; subtle progress indicator | Cancel only when meaningful |
| Empty-first-use | Explain why empty and provide the permitted primary creation/next step | Role-authorized action |
| Empty-filtered | State that filters caused no results; preserve filters | Clear filters |
| Validation failure | Error summary plus field-level message; preserve all safe input | Correct and resubmit |
| Provider pending | Name the product action, not secret/provider detail; show last update | Refresh or leave safely |
| Provider unavailable | Explain impact and next step; never expose credentials/raw URL | Retry or contact support |
| Offline/network lost | Preserve safe unsent input locally in memory; indicate reconnect | Retry after connection |
| Conflict/stale write | Show changed record, preserve local input, prohibit blind overwrite | Reload/compare/reapply |
| Permission denied | Neutral explanation; no protected existence leak | Return to role home |
| Session expired | Preserve safe internal return route and non-sensitive form draft | Sign in again |
| Success | Inline confirmation tied to affected entity; persistent readback | Continue/view record |
| Partial batch failure | Per-item success/failure; no duplicate retry of successes | Retry failed only |
| Archived/inactive | Explain retained data and permitted recovery actor | Restore/reactivate if allowed |

Toasts supplement but never replace persistent readback or a required error. Success toasts last at least five seconds and are accessible from a notification region.

## UI-009. Shared component catalog

### UI-009.1 Actions

| Component | Required variants and behavior |
|---|---|
| Primary button | Yellow/black; one per action region; default, hover, pressed, focus, loading, disabled-with-explanation |
| Secondary button | Transparent/outlined; same interaction states |
| Tertiary button/link | Text action; underline on hover/focus; not used for destructive action |
| Danger button | Danger color plus explicit verb; confirmation for material impact |
| Icon button | Accessible name, tooltip, 44px touch target when touch-relevant |
| Split/menu action | Only when actions share one entity; keyboard arrow/Escape behavior |

Double activation is prevented while a mutation is in flight. A retry uses the original idempotency intent where the domain contract requires it.

### UI-009.2 Forms

- Labels remain visible above fields; placeholders are examples only.
- Required and optional status is explicit.
- Password fields provide show/hide, requirements before submit, and no current-password reveal.
- Username availability is checked without exposing another Student.
- Phone uses international format only when collected.
- Timezone uses searchable IANA city labels, not raw offsets alone.
- Consent checkboxes are never preselected.
- Destructive confirmations state the exact entity and effect.
- A server rejection preserves all safe user-entered values.

### UI-009.3 Data display

| Component | Normative behavior |
|---|---|
| Summary cell | One metric, label, timeframe, and navigation target; equal height within a row, not forced across unrelated content |
| Record card | Clear entity title, state, primary metadata, and one direct action |
| Data table | Sort labels, accessible headers, pagination, row actions, loading/empty/error states |
| Filter bar | URL-backed filters, active-filter count, Clear all, compact mobile drawer |
| Status chip | Text plus icon and semantic status; never color-only |
| Timeline | Actor, action, timestamp/timezone, result, and safe detail |
| Details drawer | Context without route loss; direct link available for durable entities |
| Tabs | Route-backed for major sections; arrow-key behavior; never hide unsaved form changes |

### UI-009.4 Calendar

Admin supports Month, Week, Day, and Agenda. Parent supports Month, Week, and List. Student supports Today, Week, and simple agenda.

Calendar requirements:

- Gregorian English dates only;
- visible timezone;
- Today, previous/next, and date picker;
- equal date-cell geometry at the same responsive mode;
- event chips show title, time, and status;
- selected day and today are distinct beyond color;
- keyboard selection and equivalent agenda;
- canceled events remain visible with canceled label;
- rescheduled events identify the new time;
- mobile defaults to agenda rather than compressing a month grid.

### UI-009.5 Upload and processing

The upload component supports:

- file picker and drag/drop equivalent;
- one file up to 5 GiB;
- supported format/size instruction before selection;
- streaming/resumable or safely restartable progress;
- filename, bytes transferred, percentage, and current stage;
- cancel before commit;
- checksum/deduplication result;
- safe retry;
- duplicate-source explanation when Drive and app contain the same file;
- queue/dead-letter recovery link for Admin.

Drag/drop is never the only input method.

### UI-009.6 Media review and playback

Admin review presents video, trim handles plus precise time inputs, transcript, captions, worksheet/review, knowledge-base draft status, occurrence assignment, and publication state.

Trim controls:

- support keyboard and text entry;
- prevent end before start;
- preserve the original source;
- show processed-preview status;
- require explicit approval before publication.

Student playback:

- uses the protected One Time route;
- resumes from the last safe position;
- shows class/date/topic and structured Mishnah references when available;
- offers transcript and approved review material;
- never displays a raw Vimeo URL.

### UI-009.7 Embedded classroom

The Student classroom screen contains:

- class and occurrence identity;
- connection/preflight state;
- embedded Zoom region;
- microphone-muted entry readback;
- camera/recording consent guidance;
- reconnect state;
- leave control;
- technical support action;
- clear second-device denial;
- no participant chat, file transfer, renaming, screen sharing, or raw Zoom destination.

The Admin Live Console shows roster, join/readiness, attendance, connection, questions, recording guidance, and audited reset/end actions. Live status updates without a full-page refresh and shows last-update/stale state.

### UI-009.8 Search

Admin global search covers adults, households, Students, classes, occurrences, content, questions, and tickets.

- Search is available from the Admin header and `/app/search`.
- Results group by entity type and show safe distinguishing metadata.
- Search matches exact IDs where safe, normalized adult email/phone, names, titles, and approved content metadata.
- No protected result appears before authorization.
- Empty, error, keyboard navigation, recent-query clearing, and pagination states are supported.
- Search queries are not placed in third-party analytics.

Student library search covers title, English transcript, date, class/topic, and structured Mishnah references when available. It never searches sibling or unpublished content.

## UI-010. Public screen catalog

| Screen ID | Route ID | Screen | Primary action | Required states |
|---|---|---|---|---|
| `SC-PUB-001` | `RT-PUB-001` | Landing | Start Family signup | Before/after free expiry, mobile hero, provider-independent |
| `SC-PUB-002` | `RT-PUB-002` | Family signup | Create free account before expiry; create account and continue to checkout at/after expiry | Boundary instant, validating, durable accepted, duplicate active, outbox pending, failure/retry |
| `SC-PUB-003` | `RT-PUB-003` | Family signup accepted | Continue to Parent overview before expiry; continue to Checkout at/after expiry | Local commit complete, signed-in session established, provider projection pending/quarantined, checkout continuation when applicable |
| `SC-PUB-004` | `RT-PUB-004` | School inquiry | Send school inquiry | Validation, accepted, duplicate/repeat, failure |
| `SC-PUB-005` | `RT-PUB-005` | School received | Return home | Acknowledged/manual follow-up |
| `SC-PUB-006` | `RT-PUB-006` | Privacy | None | Current version, print/read |
| `SC-PUB-007` | `RT-PUB-007` | Terms | None | Current version, print/read |
| `SC-PUB-008` | `RT-PUB-008` | Cancellation/refund | Start signup | Before/after subscription |
| `SC-PUB-009` | `RT-PUB-009` | Public support | Send request | Validation, accepted, failure |

### UI-010.1 Landing composition

The landing page order is:

1. offer and Family signup CTA;
2. live-from-Eretz-Yisrael identity and Rabbi Eli;
3. recurring Sunday–Thursday, 7:00 p.m. Jerusalem schedule with viewer-local conversion;
4. live embedded class, separate Student access, and library explanation;
5. Family plan: USD $67/month after free period, normally up to three Students;
6. canonical free-period status/countdown or post-expiry offer;
7. how adult learners use a separate Student seat;
8. Family versus School entry;
9. approved testimonials/publications only;
10. device/camera/recording expectation;
11. cancellation/refund and legal links;
12. login CTA and support.

The countdown uses the server-synchronized canonical instant and displays days, hours, and minutes without an assertive live announcement.

### UI-010.2 Family signup

The form collects exactly:

- adult first name;
- adult last name;
- normalized email;
- password and confirmation;
- IANA household timezone, prefilled from the browser only as an editable suggestion;
- required current Terms/privacy acceptance;
- separate optional general-marketing consent;
- separate optional Parent-newsletter consent.

It does not collect phone, country, Student information, learner relationship, guardian/recording/recognition consent, reminder preference, or a card.

Before `2026-09-11T18:00:00+03:00`, the primary CTA is **Create your Family account** and helper copy is exactly: **No credit card required. Free access ends September 11, 2026 at 6:00 PM Asia/Jerusalem.** A successful submission establishes the signed-in Parent session from the submitted email/password, creates one free Family household, and continues directly to the Parent overview where Student creation is immediately available. It does not send or require a setup link.

At or after the boundary instant, the primary CTA is **Create account and continue to checkout**. A successful submission creates the adult and household with inactive product access, then continues to GHL-hosted standard checkout. The signup form itself never charges. Student creation and learning remain unavailable until verified paid access is projected. No submission receives a new or rolling trial.

Acceptance commits locally before provider side effects. Ambiguous GHL matching quarantines only the CRM linkage: local authentication and pre-expiry free access continue, while GHL sync/workflow and paid checkout remain blocked pending Admin resolution. The safe result never enumerates an unrelated email.

### UI-010.3 School inquiry

The School form collects exactly school name, contact first name, contact last name, and email. Phone and a note are optional. It does not collect a password, card, learner count, country, timezone, Students, or consent for product access. It clearly states:

- this is an inquiry, not product signup;
- no automatic access is created;
- no nurture sequence begins;
- One Time will follow up manually.

The primary CTA is **Send school inquiry**. The durable success copy is exactly: **Thanks—we received your school inquiry. We’ll be in touch shortly.** Repeated submissions update or append to the same adult lead record when safely matched, but never create a household, subscription, Student, or authenticated session.

## UI-011. Authentication screen catalog

| Screen ID | Route ID | Screen | Primary action | Critical behavior |
|---|---|---|---|---|
| `SC-AUTH-001` | `RT-AUTH-001` | Universal login | Sign in | One identifier, password, role route, safe return |
| `SC-AUTH-002` | `RT-AUTH-002` | Forgot password | Send reset link | Generic response, adult email only |
| `SC-AUTH-003` | `RT-AUTH-003` | Account setup | Set password and accept | Seven-day single-use token |
| `SC-AUTH-004` | `RT-AUTH-004` | Reset password | Save new password | 60-minute single-use token |
| `SC-AUTH-005` | `RT-AUTH-005` | Household switcher | Continue to household | Owned households only |
| `SC-AUTH-006` | `RT-AUTH-006` | Access denied | Return safely | No existence leakage |
| `SC-AUTH-007` | `RT-AUTH-007` | Session ended | Sign in | Safe return route |
| `SC-AUTH-008` | `RT-AUTH-008` | Role context selector | Continue as Admin or Parent | Only memberships on the one signed-in account |

Login distinguishes email-shaped adult identifiers from valid Student usernames without exposing which account type exists. Student forgot-password guidance directs the Student to the household account owner or One Time support.

A dual-role adult sees two plain choices—**Continue as Admin** and **Continue as Parent**—with a one-sentence description of each context. The selection is server-authorized, stored in the session, visible in the account menu, and switchable without a second login. No screen merges Admin and Parent navigation or infers elevated context from a requested route.

There is no MFA enrollment, authenticator, recovery-code, SMS/email challenge, optional-MFA preference, or MFA challenge screen at launch. Admin and Parent authentication is email plus password; Student authentication is username plus password.

## UI-012. Admin screen catalog

### UI-012.1 Dashboard and search

| Screen ID | Route ID | Screen | Primary content/action |
|---|---|---|---|
| `SC-ADM-001` | `RT-ADM-001` | Operating dashboard | Now/Next Class and primary class action |
| `SC-ADM-002` | `RT-ADM-002` | Global search | Search all authorized operational entities |

Dashboard hierarchy:

1. **Now & Next** — current/next occurrence, readiness, Live Console;
2. **Needs Attention** — failed access/billing, Zoom gaps, upload/content failures, unanswered questions, open urgent tickets;
3. **Content Pipeline** — received/processing/review/publishing failures;
4. **People and Learning** — active households/Students, attendance and badge summary;
5. **Recent Activity** — communications and audit;
6. **Provider Health** — compact when healthy, expanded when degraded.

Provider setup is shown as an ordinary actionable status, never a first-run wizard or modal blockade.

### UI-012.2 People and account administration

| Screen ID | Route ID | Screen | Primary action |
|---|---|---|---|
| `SC-ADM-010` | `RT-ADM-010` | Adult list | Add adult |
| `SC-ADM-011` | `RT-ADM-011` | Adult detail | Edit adult |
| `SC-ADM-012` | `RT-ADM-012` | Household list | Add household |
| `SC-ADM-013` | `RT-ADM-013` | Household detail | Add/manage Student |
| `SC-ADM-014` | `RT-ADM-014` | Human-account list | Create Admin/Parent |
| `SC-ADM-015` | `RT-ADM-015` | Human-account detail | Govern account/session |
| `SC-ADM-016` | `RT-ADM-016` | Student list | Add Student |
| `SC-ADM-017` | `RT-ADM-017` | Student detail | Edit credentials/state |

Lists implement search, sort, filter, pagination, archived visibility, URL-backed state, and safe empty/error states. Household detail separates identity, seat allowance, Students, canonical class enrollment, access/billing, support, and audit.

Ownership transfer shows the current and replacement adult, household, dependent Students, any outgoing-owner `self` Student, provider references that remain attached, and the exact session/access effects. Transfer cannot continue while an active outgoing-owner `self` Student remains; the UI offers only **Archive self Student** or **Move to my other household** when an eligible owned household has a free seat. It never offers automatic conversion or assignment to the replacement. The replacement acceptance screen records current authority and required recording consent for each dependent before one atomic completion.

### UI-012.3 Content

| Screen ID | Route ID | Screen | Primary action |
|---|---|---|---|
| `SC-ADM-020` | `RT-ADM-020` | Pipeline queue | Upload recording |
| `SC-ADM-021` | `RT-ADM-021` | Direct upload | Start upload |
| `SC-ADM-022` | `RT-ADM-022` | Content detail | Continue current lifecycle action |
| `SC-ADM-023` | `RT-ADM-023` | Content review | Approve outputs |
| `SC-ADM-024` | `RT-ADM-024` | Admin library | Open content |

Pipeline queue groups actionable states: Failed, Needs Review, Processing, Publishing, Published, Archived. It shows source, checksum/dedupe result, occurrence match, size/duration, last update, and safe retry.

### UI-012.4 Classroom

| Screen ID | Route ID | Screen | Primary action |
|---|---|---|---|
| `SC-ADM-030` | `RT-ADM-030` | Classroom overview | Open next occurrence |
| `SC-ADM-031` | `RT-ADM-031` | Admin calendar | Create/schedule occurrence |
| `SC-ADM-032` | `RT-ADM-032` | Class series list | Create class |
| `SC-ADM-033` | `RT-ADM-033` | Class series detail | Edit recurrence |
| `SC-ADM-034` | `RT-ADM-034` | Occurrence list | Open occurrence |
| `SC-ADM-035` | `RT-ADM-035` | Occurrence workspace | Prepare Class & Send Access |
| `SC-ADM-036` | `RT-ADM-036` | Enrollment/readback | Reconcile roster |
| `SC-ADM-037` | `RT-ADM-037` | Zoom readiness | Retry failed readiness |
| `SC-ADM-038` | `RT-ADM-038` | Attendance | Review/correct attendance |
| `SC-ADM-039` | `RT-ADM-039` | Recordings view | Open matched content |
| `SC-ADM-040` | `RT-ADM-040` | Question moderation | Answer/moderate |
| `SC-ADM-041` | `RT-ADM-041` | Progress and badges | View awarded badges |
| `SC-ADM-042` | `RT-ADM-042` | Leaderboards | Select category |
| `SC-ADM-043` | `RT-ADM-043` | Access projection | Repair exception |

Occurrence workspace orders:

1. lifecycle and time;
2. current primary action;
3. roster/Student registration result;
4. notification preview/result;
5. Zoom and embedded-class readiness;
6. questions;
7. attendance;
8. recording/content;
9. audit.

Class-series detail exposes only lifecycle-valid actions:

| Current state | Visible primary actions | Consequence copy |
|---|---|---|
| `draft` | Activate; Archive | Activate begins the rolling occurrence horizon and canonical enrollment policy. Archive keeps history and creates nothing. |
| `active` | Pause; Archive | Pause stops future generation without deleting existing occurrences. Archive stops generation and removes the series from active scheduling. |
| `paused` | Resume; Archive | Resume returns the series to active generation. Archive stops it permanently until restored. |
| `archived` | Restore to draft | Restore never activates directly; it returns the series to draft for review. |

Each lifecycle mutation shows the series name, current and target states, generation/enrollment consequence, affected future-occurrence count, reversibility, and an effect-specific confirmation verb. Success returns persisted state and audit readback. Repeating the same command is idempotent. `archived → active` is not a valid transition.

The launch canonical series is visually labeled **Automatic enrollment**. Its roster screen has no opt-out or manual unenroll control. Student creation, restore, and eligibility activation atomically commit both Student eligibility and canonical enrollment; a failure rolls back the whole mutation. Reconcile repairs missing/extra policy rows and reports its exact changes. Manual unenroll appears only for a future noncanonical series.

### UI-012.5 Live Console

| Screen ID | Route ID | Screen | Primary action |
|---|---|---|---|
| `SC-ADM-050` | `RT-ADM-050` | Live selection | Open current/next class |
| `SC-ADM-051` | `RT-ADM-051` | Live Console | Operate current occurrence |

The Live Console prioritizes live status and questions above historical detail. Ending/closing class, resetting a Student live session, attendance correction, and publication are distinct audited actions with effect-specific confirmation.

### UI-012.6 Admin utilities

| Screen ID | Route ID | Screen | Primary action |
|---|---|---|---|
| `SC-ADM-060` | `RT-ADM-060` | Communications | Open workflow readback |
| `SC-ADM-061` | `RT-ADM-061` | Workflow readback | Governed Start/Pause request |
| `SC-ADM-062` | `RT-ADM-062` | Ticket queue | Open highest-priority ticket |
| `SC-ADM-063` | `RT-ADM-063` | Ticket detail | Reply/change status |
| `SC-ADM-064` | `RT-ADM-064` | Billing & Access | Repair selected exception |
| `SC-ADM-065` | `RT-ADM-065` | Integrations | Inspect/configure provider |
| `SC-ADM-066` | `RT-ADM-066` | Operations | Inspect current exception |
| `SC-ADM-067` | `RT-ADM-067` | Audit | Filter/export authorized evidence |
| `SC-ADM-068` | `RT-ADM-068` | Admin help | Follow governed escalation |
| `SC-ADM-069` | `RT-ADM-069` | Admin account | Change own account/session |

Communications is readback and governed execution. Campaign body authoring stays in GHL. The One Time screen shows segment, suppression count, sender, subject/rendered-copy readback, cadence, readiness, delivery readback, and a safe GHL deep link. It exposes no production “test send,” provider seed, or preview-mode action; bounded provider canaries run only through the release-verification harness.

## UI-013. Parent screen catalog

| Screen ID | Route ID | Screen | Primary action | Explicit boundary |
|---|---|---|---|---|
| `SC-PAR-001` | `RT-PAR-001` | Parent overview | Add first Student or open next Parent task | No Student learning |
| `SC-PAR-002` | `RT-PAR-002` | Students | Add Student within allowance | Owned household only |
| `SC-PAR-003` | `RT-PAR-003` | New Student | Create Student | No fourth standard seat |
| `SC-PAR-004` | `RT-PAR-004` | Student management | Save profile/reset credentials | No private questions |
| `SC-PAR-010` | `RT-PAR-010` | Family calendar | Open occurrence | Summary only |
| `SC-PAR-011` | `RT-PAR-011` | Parent class detail | View schedule/status | Cannot enter classroom |
| `SC-PAR-020` | `RT-PAR-020` | Progress summary | Select Student | Parent-safe summary |
| `SC-PAR-021` | `RT-PAR-021` | Student progress summary | Review attendance/badges | No library playback |
| `SC-PAR-030` | `RT-PAR-030` | Billing/reactivation | Continue/manage subscription | Hosted provider action |
| `SC-PAR-040` | `RT-PAR-040` | Updates | Open notice | Household scoped |
| `SC-PAR-041` | `RT-PAR-041` | Newsletter archive | Open issue | Adult only |
| `SC-PAR-050` | `RT-PAR-050` | Reminder preferences | Save preference | WhatsApp availability truthful |
| `SC-PAR-060` | `RT-PAR-060` | Support | Submit request | Adult GHL link allowed |
| `SC-PAR-061` | `RT-PAR-061` | Support detail | Reply/view status | Own request only |
| `SC-PAR-070` | `RT-PAR-070` | Account | Manage password/household context | No role change |
| `SC-PAR-071` | `RT-PAR-071` | Privacy and consents | Review/change eligible consent | Consequence preview; no hidden coupling |
| `SC-PAR-072` | `RT-PAR-072` | Data rights | Start/track/download governed request | Own adult or reviewed dependent request |

### UI-013.1 Parent activation

The Parent overview is a normal dashboard after activation and a bounded checklist before activation:

1. account and current policy acceptance complete;
2. household timezone confirmed;
3. first Student created with actual name;
4. Student username/password set;
5. canonical class automatic enrollment read back;
6. next occurrence displayed;
7. optional reminder preference selected.

The checklist is resumable and disappears when complete. It is not an Admin provider-setup wizard.

### UI-013.2 Student credential handoff

At Student creation/reset, the Parent may copy or print the username and the newly entered password before leaving the success state. The system does not redisplay the password later. The credential handoff:

- labels the exact Student;
- excludes internal IDs;
- advises storage by the account owner;
- does not email credentials;
- provides a future reset action.

### UI-013.2A Learner relationship and name

New Student begins with one required question: **Who is this learner?**

- **Myself** stores relationship `self` and displays: **Please use your actual name so Rabbi Eli can identify you during class.**
- **Someone I manage** stores relationship `dependent` and displays: **Please use the Student’s actual name so Rabbi Eli can identify them during class.**

The form then collects actual name, optional display name, username, password, and password confirmation. It never collects date of birth, age, age band, grade, or a Hebrew-specific name field. A self learner is still a separate Student login and consumes one of the three seats. A dependent flow collects the separately scoped authority, recording, and optional leaderboard-recognition consents at the point where each applies; the public Family signup does not collect them.

### UI-013.3 Parent access states

| Access state | Parent experience |
|---|---|
| `free` | Full Parent management; exact free-end time; scheduled continuation offer |
| `active` | Full Parent management; plan and period-end readback |
| `grace` | Full Parent management; prominent days/time remaining and repair CTA |
| `inactive` | Overview/status, billing/reactivation, support, account, privacy/data rights, and household switcher only |

No inactive or Parent route exposes the Student classroom or library.

For `inactive`, navigation and route authorization use the same exact allowlist: Parent overview, billing/reactivation, support list/detail, account, privacy, data rights, and household switcher. Students, calendar/class detail, progress, updates, newsletter, reminder preferences, and all Student surfaces are absent. An excluded direct link resolves to the persistent inactive-access screen before any protected page data renders.

### UI-013.4 Privacy and data-rights screens

Privacy shows current policy versions, separate consent scopes, current status, evidence timestamp, eligible withdrawal controls, and a consequence preview before confirmation. Withdrawing one optional scope does not withdraw another.

Data rights supports adult access/export, account closure, erasure where legally eligible, and a reviewed request concerning a dependent Student. It requires recent-password reauthentication, explains that ordinary Parent export excludes private Student question/support bodies, and shows request status as `requested`, `processing`, `completed`, `partially_excepted`, or `failed`. A completed download uses a one-time link valid for 15 minutes. Closure and erasure are distinct actions. Every status, exception reason category, provider cascade result, and final expiry is visible without exposing internal secrets.

## UI-014. Student screen catalog

| Screen ID | Route ID | Screen | Primary action |
|---|---|---|---|
| `SC-STU-001` | `RT-STU-001` | Today | Join Class when available |
| `SC-STU-010` | `RT-STU-010` | Calendar | Open next occurrence |
| `SC-STU-011` | `RT-STU-011` | Class detail | Join or review status |
| `SC-STU-012` | `RT-STU-012` | Embedded classroom | Enter/reconnect/leave |
| `SC-STU-020` | `RT-STU-020` | Library | Open/resume content |
| `SC-STU-021` | `RT-STU-021` | Playback and review | Resume/play recording |
| `SC-STU-030` | `RT-STU-030` | Progress | Review goals/badges/category |
| `SC-STU-040` | `RT-STU-040` | Questions | Ask a question |
| `SC-STU-041` | `RT-STU-041` | New question | Submit question |
| `SC-STU-042` | `RT-STU-042` | Question detail | Read private answer/status |
| `SC-STU-050` | `RT-STU-050` | Updates | Open update |
| `SC-STU-051` | `RT-STU-051` | Notifications | Mark/open notification |
| `SC-STU-060` | `RT-STU-060` | Technical support | Submit request |
| `SC-STU-061` | `RT-STU-061` | Support detail | Reply/view status |
| `SC-STU-070` | `RT-STU-070` | Account | Log out |
| `SC-STU-071` | `RT-STU-071` | Privacy and consents | Self-managed adult Student only |
| `SC-STU-072` | `RT-STU-072` | Data rights | Self-managed adult Student request/status only |

The last two screens are absent for a dependent Student. They appear only when relationship is `self` and the verified adult identity owns the Student profile. They use the same recent-password reauthentication, status vocabulary, one-time 15-minute download, closure-versus-erasure distinction, and consequence-preview contract as the Parent screens, scoped only to that Student identity.

### UI-014.1 Today priority

Today orders:

1. current or next canonical class;
2. Join/reconnect state or countdown;
3. latest assigned lesson/recording;
4. unanswered/readable question status;
5. new notice count;
6. progress toward the next fixed badge.

The greeting uses the approved display/first name, not a full legal name.

### UI-014.2 Join states

| Occurrence/access state | Student presentation |
|---|---|
| Scheduled, outside join window | Date/time/timezone and countdown; Join absent |
| Preparing | “Class is being prepared”; automatic refresh, no fake Join |
| Ready, join window open | Primary Join Class |
| Live | Primary Join Class or Reconnect |
| Same-session reconnect | Reconnect with preserved Student identity |
| Second device active | Clear denial and ask Parent/Admin to reset |
| Canceled | Canceled label and Admin message; no Join |
| Completed | Recording status when approved; no Join |
| Access `grace` | Normal Student access |
| Access `inactive` | Login/route blocked with: “This household’s access is inactive. Ask your account owner to restore access.” |
| Provider unavailable | Safe retry and technical support; no raw provider link |

### UI-014.3 Questions and privacy

Question submission contains class context, concise question field, submission state, and privacy explanation. Parent sessions never expose the list, question text, Rabbi answer, or status. A Student sees only their own questions.

Question status labels map exactly to the lifecycle in `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md`. “Approved for class” explains that Rabbi Eli may discuss it. “Published” identifies the member-visible result without exposing other private information.

### UI-014.4 Goals, badges, and leaderboard

Student progress contains three system-defined goal families:

- attend class consistently;
- ask meaningful questions;
- attend/complete review.

Badges are fixed:

- Consistency I/II/III at 5/20/60 consecutive scheduled attendances;
- Curious Learner I/II/III at 1/5/15 questions answered or approved for class;
- Review Ready I/II/III at 1/4/12 completed review events.

For Curious Learner, one question contributes at most one recognition event. The event is first created when the question first reaches `answered_private` or `approved_for_class`; later approval or publication of the same question does not add another. Revocation or correction recalculates the affected badge and leaderboard projection from the event ledger.

There is no point balance, redeemable currency, reward catalog, Parent-created goal, or badge editor.

Leaderboard uses separate rolling-30-day views:

- attendance count;
- current attendance streak;
- questions approved/published.

Leaderboard recognition is a separate, optional consent scope and defaults off. When recognition is on, member-visible names use first name plus last initial. When it is off or withdrawn, the Student remains eligible and ranked: that Student sees **You**, while other Students see a stable, class-scoped, nonidentifying alias such as **Anonymous Student • A7**. Withdrawal updates future display without rewriting the underlying attendance/question facts. Ties share rank and subsequent rank uses competition ranking. The board never combines categories into a vague score and never exposes a full name or private question.

### UI-014.5 Notification center

The Student notification center supports:

- unread count and badge;
- unread/read filters;
- mark one or all read;
- safe internal deep links;
- class, content, question, access, and Admin notice types;
- visual timestamp in Student/household timezone;
- optional audible cue while the portal is open.

The audible cue is off until enabled. Background push/PWA delivery is absent.
Notification category, dedupe, expiry, stale-action, and sound behavior is defined exactly in WNC-8 of `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`; the UI may not invent another notification state.

## UI-015. Time, date, and locale presentation

- Persisted instant behavior is governed by `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md`.
- Recurring launch class begins at `2026-08-16T19:00:00+03:00` and remains anchored to 7:00 p.m. `Asia/Jerusalem`.
- Parent and Student screens display the household timezone and its unambiguous abbreviation/offset.
- Admin calendar may switch display timezone but defaults to class timezone.
- Browser timezone is an editable signup suggestion only.
- Dates use an English month name, for example `Monday, September 14, 2026`.
- Times use 12-hour public copy with `a.m./p.m.` and a visible zone label; compact UI may use `7:00 PM`.
- Hover/title text may show the canonical Jerusalem time when a local conversion is displayed.
- No Hebrew date appears.
- Currency renders as `USD $67.00` in billing detail and `$67/month` in approved public summary copy.

## UI-016. Destructive actions, conflicts, and audit presentation

Material actions—including archive, disable, transfer ownership, reset sessions, cancel occurrence, noncanonical-series unenrollment, unpublish, close live class, and governed campaign Start—show:

- exact entity name;
- exact effect;
- affected count when multiple records are involved;
- whether access, notification, or provider state changes;
- whether the action is reversible;
- explicit action verb, never generic “Yes”;
- cancellation that leaves state unchanged.

Optimistic conflicts never silently overwrite another Admin. The conflict UI presents current persisted values and preserves the attempted values for comparison/reapplication.

An audit readback follows every material successful action and identifies the actual Admin actor.

## UI-017. Explicitly absent UI

Production contains no screen, tab, card, route, CTA, disabled teaser, navigation item, or settings control for:

- BNA or cross-workspace navigation;
- demo/preview/test experiences;
- Class Helper;
- Buffer/social publishing;
- Parent Learner Mode;
- co-guardian invitation;
- school administration or bulk roster;
- Parent Student-library playback;
- Parent access to private Student questions;
- Parent-created goals;
- editable badge thresholds;
- reward points, catalog, or redemption;
- favorites;
- PWA/background push;
- MFA enrollment, MFA challenge, recovery-code, or optional-MFA settings;
- WhatsApp lead assistant;
- open Student chat;
- Hebrew interface;
- Google Calendar synchronization;
- advanced editing beyond beginning/end trim and text/material correction.

## UI-018. UI release certification

The exact release candidate passes:

- every screen/route listed here at its supported viewport;
- desktop and tablet full Admin journeys;
- mobile urgent Admin subset with clear dense-workflow boundary;
- Parent at 360px, tablet, and desktop;
- Student on three separate real tablet/browser profiles;
- keyboard-only public, authentication, Parent, Student, and representative Admin journeys;
- screen-reader verification for login, signup, Student creation, calendar agenda, Join Class, playback, question, support, billing state, and dialog behavior;
- 200% text and 400%/320px reflow;
- reduced-motion and audible-cue-off behavior;
- supported browser matrix;
- zero viewport overflow outside an intentional bounded data region;
- zero broken, untested, placeholder, deferred, fake-data-dependent, or unauthorized visible controls;
- repository route, component, API, feature-flag, configuration, and copy inventories proving that no MFA enrollment, challenge, recovery-code, or optional-MFA surface is reachable.

Evidence and exact acceptance identifiers are defined in `02-ACCEPTANCE-CONTRACT-v2.1.yaml` and mapped in `14-TRACEABILITY-CROSSWALK-v2.1.yaml`.
