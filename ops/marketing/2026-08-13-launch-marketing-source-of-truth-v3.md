# One Time Mishnayos — Launch Marketing Source of Truth v3

**Decision date:** 2026-08-13  
**Preparation:** August 13–15, 2026  
**Active free-access campaign:** August 16–September 11, 2026  
**Owner:** Shloimie Dratler  
**Final video editor:** Rabbi Eli Scheller  
**Status:** **CURRENT MARKETING AUTHORITY — SUPERSEDES v2 WHERE DIFFERENT**

## 1. Authority and non-interference

This file extends and supersedes `2026-08-13-30-day-launch-marketing-source-of-truth-v2.md` where the two differ.

Product authority remains PR #131 and the one-checkbox operator override. Marketing work must not modify, merge, rebase, retarget, deploy, or otherwise interfere with the active complete-production launch branch unless a separately authorized product handoff is accepted by that lane.

Marketing execution uses separate Codex/Work Ultra windows, separate worktrees, separate child branches, and non-overlapping write scopes.

The current product UI decision remains exactly one required, initially unchecked checkbox labeled `I agree to the Terms of Use`; no second visible consent checkbox is permitted. Legal review remains a deployment gate.

## 2. Locked funnel

```text
Facebook / eligible Instagram / WhatsApp distribution / YouTube
        ↓
https://join.onetimeonetime.com
        ↓
GET FREE ACCESS
        ↓
CREATE YOUR FREE FAMILY ACCOUNT
        ↓
Student setup
        ↓
Attend live class or watch first lesson
        ↓
Paid continuation after the fixed free-access period
```

WhatsApp is a distribution surface only. It is never the lead destination and never replaces the landing page.

## 3. Audience and offer

- Primary audience: English-speaking Jewish parents in the United States with boys approximately ages 7–13.
- Schools are excluded from this launch-month campaign.
- First class: Sunday, August 16, 2026 at 7:00 p.m. Israel time.
- Free access ends: September 11, 2026 at 6:00 p.m. Jerusalem time.
- No card is required during the fixed free-access period.
- Standard paid price: USD $67/month per Family household, normally including up to three Students.
- Core promise: **A real rebbe. One perek at a time. Live from Eretz Yisrael and available on demand.**

## 4. Currency and ad-spend accounting

### Primary operating currency

Use **USD as the primary marketing and unit-economics currency** because:

- the customer price is USD;
- the American audience sees USD;
- Meta can be funded from the American bank in USD;
- paid CAC and paid LTV are most intelligible in the same currency.

If the Meta ad account and American payment source are both denominated in USD, the ad charge itself does not need a USD→ILS conversion. ILS matters for Israeli management reporting, transfers, tax/accounting records, and local-cost comparison.

### Secondary ILS reporting

Every paid-spend record should store:

- `spend_usd`;
- `fx_rate_usd_ils`;
- `fx_rate_date`;
- `fx_rate_source`;
- `spend_ils_reference`;
- `actual_settlement_ils`, if money was actually converted or settled in ILS;
- `conversion_fee_or_spread`, when known.

Use the Bank of Israel daily representative USD/ILS series `RER_USD_ILS` for internal reference reporting. The representative rate is indicative, not necessarily the rate charged by a bank, card issuer, or transfer provider. For bookkeeping, preserve the actual statement/settlement amount and follow the accountant’s treatment.

Do not hard-code one exchange rate into the marketing system. The rate must be date-stamped.

### Planning examples

Using an example reference rate of approximately 3.073 ILS per USD:

- $300 ≈ ₪922;
- $500 ≈ ₪1,537;
- $1,000 ≈ ₪3,073;
- $1,500 ≈ ₪4,610;
- $5,000 ≈ ₪15,365;
- $67 monthly revenue ≈ ₪206;
- $200 paid CAC ≈ ₪615.

These are planning examples only, not accounting records.

## 5. Competitive price position

Current public benchmark set:

| Program | Published offer | Published price | Comparison note |
|---|---|---:|---|
| One Time Mishnayos | Live Sunday–Thursday + on-demand, Family up to 3 Students | $67/month/Family | About $3.09 per household class-day; about $1.03 per child/class-day at 3 Students |
| Kitah Mishnah | Weekly live Zoom + asynchronous Mishnah lesson and evaluation | $99/month/child + $50 registration | Higher monthly price for weekly live contact |
| Kitah Chumash & Mishnah | Weekly live Zoom + asynchronous lessons in two subjects | $149/month/child + $50 registration | Higher-priced broader curriculum |
| Kitah High | Weekly 40-minute live session + weekly materials | $99/month | Weekly, not daily |
| MyShliach Yeshivas Erev | Four live nights/week, 45 minutes, chavrusa and prizes | $125 non-member published fee; free for $36 annual members | Published page does not present this as a monthly fee |
| A Mishna a Night | Live Sunday–Thursday, 20 minutes, prizes and guests | No learner fee displayed | Strong free/sponsored attention competitor |
| Shloff Gezunt | Sunday–Thursday audio/hotline Mishnah + story, prizes/newsletter | £6.50/month | Low-cost audio membership, not interactive video hybrid |
| Torah Live Family | Large on-demand library, games and profiles | $14.99/month or $99/year | On-demand library, not daily live class |
| Time4Mishna | Daily shiurim and structured review/resources | Free resources/shiur access promoted | Adult-oriented structured free alternative |

### Pricing implication

$67/month is not obviously overpriced for a five-day live hybrid Family program. It sits above free/sponsored mass programs and inexpensive on-demand libraries, but below structured per-child live programs.

Do not compete mainly on price. The premium case is:

- Rabbi Eli Scheller’s teaching and personality;
- daily live rhythm;
- one perek at a time;
- live plus on-demand;
- Family access for up to three Students;
- clear long-term accomplishment;
- parent convenience and continuity.

Do not lower price based only on competitor pages. Use actual registration, activation, paid conversion, and retention data.

## 6. Conversion-rate program

### Broad external benchmark, not a promise

Education landing pages have been reported around an 8.4% median, with online-course and general-course pages materially higher in one large 2024 landing-page dataset. This is a broad benchmark, not a forecast for a narrow Jewish parent market.

For launch planning:

- under 5% landing visitor→Family registration: investigate mismatch, trust, speed, or friction;
- 5–10%: plausible cold-traffic starting range;
- 10–20%: strong for qualified traffic;
- over 20%: likely warm/referral traffic, an unusually strong offer, or a measurement issue that should be checked.

Do not judge the funnel on one blended rate. Segment WhatsApp/referral, organic Facebook, paid Facebook, Instagram placement, YouTube, and email.

### Proven/high-confidence levers

1. **Exact message match** — the ad hook, landing hero, free-access promise, date, and CTA must describe the same offer.
2. **Fast mobile landing page** — optimize hero image delivery, LCP, layout stability, and form responsiveness.
3. **Very simple copy** — short sentences, familiar words, one main promise, one main CTA.
4. **Real proof above the fold** — Rabbi teaching, real class energy, a short authentic clip, and specific testimonials.
5. **Minimal necessary form friction** — explain why the Family account is needed and defer nonessential setup steps.
6. **No surprise terms** — clearly state no card required, free-through date, class schedule, what happens after free access, and cancellation terms.
7. **Immediate activation** — after signup, direct the Parent to create the first Student and get that Student into the first class/lesson immediately.
8. **Behavior-triggered onboarding** — messages differ for: no Student created, Student created but no class use, attended live, watched recording, and approaching free-expiry.
9. **A welcome sequence, not one email** — use a short series that delivers access, explains the vision, shows proof, and guides the next action.
10. **Community and accomplishment** — show the shared journey, the perek rhythm, real progress, and the feeling of being part of something serious.
11. **Honest urgency** — start date and free-access deadline; no fake scarcity.
12. **Retarget warm people** — video viewers, landing visitors, and incomplete registrants when tracking/consent allows.
13. **One-variable tests** — change the hook, opening footage, proof, or headline one at a time.
14. **Activation and retention over vanity metrics** — views are useful only if they lead to registration, use, payment, and retention.

### Launch-month email sequence

Minimum recommended Family onboarding:

1. **Immediate:** access confirmation and exact next step.
2. **Same day / next morning:** create the Student and join/watch the first class.
3. **Day 2:** Rabbi’s vision and what makes the program different.
4. **Day 4:** real parent/Student proof and accomplishment.
5. **Day 7:** progress check and help if they have not activated.
6. **Before free expiry:** clear continuation terms and deadline.

Behavior should override the calendar. Do not tell an activated Family to perform a step it already completed.

## 7. Fast organic-to-paid decision window

- Days 1–3: publish varied hooks and identify obvious weak/strong openings.
- Days 4–7: choose approximately three provisional winners and begin a bounded paid learning test.
- Days 8–14: confirm/refine; keep one or two, replace weak versions, make controlled variants.
- Weeks 3–4: scale only when completed Family registrations and product activation are acceptable.

Organic winner selection is provisional after one week. Do not wait for perfect certainty, but do not boost based only on raw views.

Winner score hierarchy:

1. completed Family registrations;
2. activated Families;
3. landing-page click rate;
4. qualified shares/forwards;
5. watch retention/completion;
6. raw views.

## 8. Lightweight content-asset backend — no frontend

The active launch has removed/deferred social publishing UI and Buffer. Do not restore it.

Create a repository-backed marketing content registry that is compatible with a future content section but does not add production routes, database migrations, UI, provider dispatch, or scheduling.

Canonical registry location:

```text
ops/marketing/content-registry/
  README.md
  content-asset.schema.json
  assets.ndjson
  creative-packages.yaml
  publication-events.csv
  performance.csv
  fx-rates.csv
```

The registry must track:

- stable asset and creative IDs;
- source Drive file/folder IDs and view/download links;
- source filename and checksum;
- source in/out timecodes;
- duration, orientation, aspect ratio, and resolution;
- asset category and human description;
- people/student flags without exposing private data;
- rights/consent state and allowed destinations;
- package, hook, campaign, and week assignments;
- cover and first-frame relationships;
- Rabbi edit status;
- ready/scheduled/published state;
- platform post URLs/IDs when later available;
- spend in USD and ILS reference;
- impressions, three-second views, watch time, completion, clicks, registrations, activations, paid conversions, CPA, CAC, and retention checkpoints.

Drive remains the binary-media store. The repo registry remains the durable index, source of truth, and future import surface.

All Drive URLs in the registry must be access-appropriate. Do not store secrets, raw signed URLs, child names, private form data, or restricted provider bearers.

## 9. Rabbi-facing Drive system

Preserve the `Mishnayos New` source folder unchanged.

Create only a new derivative workspace:

```text
ONE TIME MARKETING — LAUNCH MONTH
  00 START HERE
  01 SOURCE SHORTCUTS - DO NOT EDIT
  02 ALL APPROVED IMAGES
  03 ALL APPROVED CLIPS
  04 VIDEO PACKS FOR RABBI
  05 CANVA AND GRAPHICS
  06 READY TO SCHEDULE
  07 POSTED AND RESULTS
  99 BLOCKED OR DO NOT USE
```

The Rabbi should not need to open CSVs, manifests, evidence ledgers, or technical folders. Each video pack contains only clips, cover/first frame, text overlays, and a one-page instruction.

## 10. Work Ultra orchestration model

Use one Work Ultra control window with bounded subagents. The control window reads current PR #131 and PR #183 authority, then assigns non-overlapping lanes.

Parallel first wave:

- market/pricing/CRO research;
- read-only landing/funnel audit;
- content-registry contract;
- read-only GHL/social connection audit;
- Drive source inventory.

Dependent second wave:

- atomic clip cutting and labeling after registry IDs are locked;
- Rabbi pack assembly after clip inventory;
- four-week calendar and copy after package IDs;
- measurement/FX scorecard after registry schema;
- paid-test plan after the first organic data exists.

Only the Drive-media lane may create derivative Drive files. Only the registry lane may write registry/schema paths. No lane may publish, schedule, broadcast, boost, spend, connect providers, deploy, or edit active product code.

## 11. Initial paid budget and dual-currency reporting

After days 4–7 of organic publishing:

- initial learning budget: approximately $300–$500 total;
- approximately $30–$50/day total;
- approximately three provisional winning creatives;
- same audience and landing page;
- one main creative variable changed at a time.

Record both USD and date-stamped ILS reference values. Do not optimize or stop an ad because the shekel equivalent appears large; optimize based on USD registration CPA, activation CPA, paid CAC, contribution LTV, and payback.

## 12. Required immediate handoffs

1. Market/pricing research appendix.
2. Content-asset registry contract and validator.
3. Full `Mishnayos New` inventory.
4. 100–150 atomic clips from 40–60 selected moments.
5. Twelve Rabbi-ready video packs.
6. Landing hero/mobile/OG-card handoff with exact CTA.
7. Four-week organic schedule.
8. GHL connection/readiness instructions, including Rabbi-owned YouTube connection.
9. Organic winner scorecard.
10. First paid-test packet with no live spend.

## 13. Stop conditions

Stop and report rather than proceeding if:

- current PR #131 authority conflicts with this lane’s write scope;
- the source folder or Drive destination cannot be identified safely;
- a student/right/third-party-media status is uncertain;
- a song license cannot be established;
- a Drive link would expose private data;
- a task requires production product code, deployment, provider connection, scheduling, publication, broadcast, or spend;
- the one-checkbox legal review is unresolved for production deployment.
