# CODEX — SHIP THE TISHA B'AV FUNNEL NOW

Execute this task. Do not return another broad audit or prompt.

## Repository and branch

Repository:

```text
shloimie-beep/onetimev2
```

Use the actual current descendant of:

```text
branch: codex/full-app-staging-live
```

Create a clean isolated worktree and branch:

```text
codex/tisha-bav-2026-funnel
```

Open a draft PR against:

```text
codex/full-app-staging-live
```

Railway PR Environments are working.

The PR must receive a Railway preview URL.

Do not create another Railway project.

## Mission

Deliver a minimal, production-capable event funnel for a live Tisha B'Av Zoom program.

The operator must be able to:

1. open the landing page;
2. enter an email;
3. optionally enter a first name;
4. register successfully;
5. see a branded thank-you state;
6. receive confirmation/reminder events through GHL;
7. reach a controlled One Time event join page;
8. attend one Zoom event.

Do not wait for the complete GHL workflow catalog, full app convergence, Telegram, Buffer, BNA or production billing.

## Event registry

Create a canonical event record:

```text
event_code: tisha-bav-2026
public_title: A Live Tisha B'Av Program with Rabbi Eli Scheller
event_start: 2026-07-23T15:00:00-04:00
timezone: America/New_York
event_start_israel: 2026-07-23T22:00:00+03:00
registration_open: true
landing_path: /tisha-bav
join_path: /tisha-bav/live
```

If the operator-provided final graphic or copy contains a different approved start time, update all event assets atomically before any send.

Create:

```text
config/events/tisha-bav-2026.json
```

The registry must not contain a raw Zoom URL or secret.

## Landing page

Route:

```text
GET /tisha-bav
```

Initial canonical public URL:

```text
https://join.onetimeonetime.com/tisha-bav
```

Requirements:

- One Time black/yellow/cream design;
- respectful Tisha B'Av tone;
- operator-provided hero image when available;
- no navigation clutter;
- event title;
- Thursday, July 23, 2026;
- 3:00 PM Eastern / 10:00 PM Israel;
- email required;
- first name optional;
- separate optional checkbox for future One Time emails;
- button:
  `Send Me the Zoom Link`
- clear privacy copy;
- accessible labels and errors;
- mobile-first;
- no Student information;
- no password;
- no payment;
- no GHL iframe.

When the final image is not yet available, use a contained branded placeholder region that can be replaced without changing form behavior.

Do not block implementation on the graphic.

## Registration API

Create a typed endpoint using repository conventions.

Suggested shape:

```text
POST /api/v1/events/tisha-bav-2026/register
```

Input:

```json
{
  "email": "adult@example.com",
  "first_name": "Optional",
  "newsletter_opt_in": false,
  "source": "tisha_bav_landing"
}
```

Requirements:

- normalized email;
- generic safe response;
- rate limit;
- CSRF when applicable;
- idempotency;
- bot/honeypot defense;
- duplicate registration updates rather than duplicates;
- store event registration in One Time;
- preserve source and timestamps;
- event-service consent is separate from marketing consent;
- no Student data.

Create the next available additive migration after inspecting the real migration ledger.

Do not assume the prefix.

Suggested tables:

```text
onetime.event_definitions
onetime.event_registrations
onetime.event_delivery_events
```

When generic event tables already exist, extend them instead of creating duplicates.

## GHL synchronization

Use the existing HighLevel integration package.

GHL location:

```text
pBSnOK2nkdxp6gf9Rg3o
```

On registration:

1. upsert the adult contact;
2. preserve unrelated tags;
3. set One Time Signup Source to `Tisha B'Av 2026 Landing`;
4. apply:
   - `OT | Event | Tisha B'Av 2026 | Registered`
   - `OT | Source | Tisha B'Av 2026`
5. add `OT | Weekly Newsletter` only when explicit newsletter consent exists;
6. do not enroll the contact into the general prelaunch nurture;
7. emit the event workflow request idempotently.

Create missing event tags through the API when absent.

Do not create Student contacts.

## Required GHL event tags

Register and reconcile:

```text
OT | Event | Tisha B'Av 2026 | Invited
OT | Event | Tisha B'Av 2026 | Registered
OT | Event | Tisha B'Av 2026 | Attended
OT | Event | Tisha B'Av 2026 | No Show
OT | Event | Tisha B'Av 2026 | Replay Sent
OT | Source | Tisha B'Av 2026
```

Do not create case/spacing duplicates.

## Sender decision

Customer-facing event communication belongs in GHL.

Immediate visible sender:

```text
Rabbi Eli Scheller | One Time Mishnayos
```

Immediate technical From:

```text
info@onetimeonetime.com
```

Reply-To:

```text
info@onetimeonetime.com
```

Do not use Resend as the normal event workflow.

Resend remains for account/security email.

## Emergency fallback

Implement a bounded fallback only because the event is time-sensitive.

Configuration:

```text
ONE_TIME_EVENT_EMAIL_FALLBACK=disabled|resend
```

Default:

```text
disabled
```

Fallback rules:

- may send only event confirmation/reminders to registered event contacts;
- may not send the warm-list invitation campaign;
- uses fixed audited templates;
- includes Reply-To info@onetimeonetime.com;
- includes unsubscribe only when the message also contains marketing content;
- records every send;
- expires automatically after 2026-07-24;
- cannot become the general delivery provider.

Do not enable fallback unless the GHL event workflow is not operational by the accepted cutoff.

## Zoom event

The operator authorizes one real event meeting.

Create or map one Zoom meeting for:

```text
Thursday, July 23, 2026
3:00 PM America/New_York
10:00 PM Asia/Jerusalem
```

Do not modify the Rabbi's regular recurring class meeting.

Store the raw join/start information only in protected server-side storage.

Create:

```text
GET /tisha-bav/live
POST /api/v1/events/tisha-bav-2026/join
```

The join page:

- asks for the registered email when no event session exists;
- verifies registration;
- rate limits;
- creates a short-lived event session;
- redirects server-side to the event;
- never renders the raw Zoom URL into static HTML;
- uses no-store and no-referrer;
- shows not-yet-open, open, ended and unavailable states.

The event join window should open before the event based on configuration.

## Thank-you state

After registration:

```text
You're registered.

We'll email the private access details before the program.

Thursday, July 23
3:00 PM Eastern / 10:00 PM Israel
```

Do not falsely claim that an email was delivered when only queued.

## Tests

Run only focused checks:

```text
event registration unit/integration tests
GHL sync mock tests
duplicate/idempotency tests
newsletter-consent negative tests
join-page authorization/rate-limit tests
mobile browser smoke
typecheck
build
secret scan
git diff --check
```

## Railway preview

Push the branch and open the draft PR.

If Railway does not create a PR Environment because the PR was opened before the integration event, close and reopen only this PR once.

Return a clickable Railway preview URL.

Use fictional/operator-owned test registrations only.

## Production release

Do not deploy production automatically in this lane.

After the operator approves the preview and supplies the final graphic, create one exact production promotion command/handoff.

Do not create a new Railway project.

Optional custom domain:

```text
tishabav.onetimeonetime.com
```

Generate a DNS/Railway setup job, but the existing `/tisha-bav` route is the launch fallback and must work without the custom domain.

## Final response

Begin exactly:

```text
TISHA_BAV_FUNNEL: READY_FOR_OPERATOR_REVIEW | BLOCKED(<one exact action>)
REGISTRATION: WORKING | BLOCKED(<reason>)
GHL_SYNC: WORKING | PROVIDER_OFF(<reason>)
ZOOM_EVENT: CREATED | BLOCKED(<reason>)
GHL_EVENT_WORKFLOW: READY_FOR_AGENT_MODE | BLOCKED(<reason>)
RAILWAY_PREVIEW_URL: <clickable URL>
PRODUCTION_CHANGED: NO
```

Then include:

- branch/head/PR;
- event time;
- preview URL;
- protected Zoom handoff path without contents;
- exact final graphic replacement path;
- one exact blocker per incomplete item.
