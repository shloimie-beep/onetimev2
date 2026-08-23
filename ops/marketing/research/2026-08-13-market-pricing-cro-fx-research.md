# One Time Mishnayos — Market, Pricing, CRO, and FX Research

**Research date:** 2026-08-13  
**Purpose:** Current launch-month decision support  
**Status:** Research appendix; current decisions live in `2026-08-13-launch-marketing-source-of-truth-v3.md`

## 1. Research posture

This document separates:

- directly observed public offer/pricing facts;
- broad conversion benchmarks;
- vendor/customer case studies;
- One Time hypotheses that require first-party testing.

No external benchmark is treated as a promise for this narrow market.

## 2. USD/ILS management

### Official reference source

Bank of Israel exchange-rate data:

- series code: `RER_USD_ILS`;
- daily representative rate;
- API guide: `https://www.boi.org.il/information/bank-paymnts/guide/api-guide/`;
- exchange-rate page: `https://www.boi.org.il/en/economic-roles/financial-markets/exchange-rates/`.

The Bank of Israel states that the representative rate is an indicator and is not legally binding on commercial transactions. Actual bank/card/transfer settlement may differ.

### Operating recommendation

- USD is the canonical advertising and customer-unit-economics currency.
- ILS is a secondary management/bookkeeping reference.
- Preserve the actual settlement record whenever currency is converted.
- Store the daily reference rate and date; do not overwrite history when the exchange rate changes.

## 3. Public competitor/adjacent pricing

### One Time Mishnayos

- $67/month per Family household;
- normally up to three Students;
- live Sunday–Thursday;
- on-demand library/review;
- source: current One Time source of truth.

Normalized planning value:

- approximately 21.7 live class-days/month;
- approximately $3.09 per household class-day;
- approximately $1.03 per child/class-day when all three Student seats are used.

### Kitah Mishnah

- weekly live Zoom;
- asynchronous lesson, source sheet, questions, progress evaluation;
- $99/month per child;
- $50 registration fee;
- source: `https://kitah.org/product/kitah-mishnah/`.

### Kitah Chumash & Mishnah

- weekly live Zoom;
- asynchronous Chumash and Mishnah lessons;
- $149/month per child;
- $50 registration fee;
- source: `https://kitah.org/product/kitah-chumash-and-mishnah/`.

### Kitah High

- weekly 40-minute interactive live session plus weekly material;
- $99/month;
- source: `https://kitah.org/product/kitah-high/`.

### MyShliach Yeshivas Erev

- Monday–Thursday live learning;
- 45-minute classes with chavrusa review, prizes, age groups, and three time zones;
- published non-member fee: $125;
- free for members; Family membership published at $36 annually;
- the public page does not characterize the $125 as a monthly fee;
- source: `https://www.myshliach.com/yeshivaserev` and `https://www.myshliach.com/members`.

### A Mishna a Night

- Sunday–Thursday;
- 20-minute live class;
- worldwide boys program, guests, prizes, raffles, recordings;
- no learner price displayed on the public registration page;
- sponsorship is promoted separately;
- source: `https://amishnaanight.com/`.

### Shloff Gezunt

- Sunday–Thursday audio/hotline program;
- Mishnah, story, music, prizes, newsletter;
- £6.50/month, with family discounts;
- source: `https://neetzotz.org/shloff-gezunt-faqs/`.

### Torah Live Family

- on-demand Torah video/game library;
- up to six child profiles;
- $14.99/month or $99/year;
- no daily live class;
- source: `https://torahlive.com/pricing`.

### Time4Mishna

- structured four-Mishnayos-per-day program;
- daily shiurim online/email/WhatsApp;
- free written resources and free access emphasized;
- adult/general audience rather than a comparable live boys class;
- source: `https://time4torah.org/`.

## 4. Pricing conclusion

The market contains three distinct groups:

1. **Free/sponsored mass learning:** A Mishna a Night, Time4Mishna.
2. **Low-cost content/audio membership:** Torah Live, Shloff Gezunt.
3. **Structured live/hybrid education:** Kitah and MyShliach-style programs.

One Time is positioned as a structured daily live/hybrid Family program, not a cheap content library. At $67 for up to three Students, it is cheaper than Kitah’s per-child monthly live/hybrid programs and materially more expensive than on-demand/audio products.

The price must be justified through Rabbi quality, daily rhythm, Family seats, live interaction, on-demand access, progress, and long-term accomplishment.

## 5. Broad conversion benchmarks

### Landing-page baseline

Unbounce reported analysis of 41,000 landing pages, 464 million visitors, and 57 million conversions in Q4 2024:

- all-industry average around 6.6%;
- education median around 8.4%;
- online course pages around 18.3%;
- general course pages around 13%;
- email traffic to education pages around 14.1%.

Sources:

- `https://unbounce.com/average-conversion-rates-landing-pages/`
- `https://unbounce.com/conversion-benchmark-report/education-conversion-rate/`

These are lead/conversion definitions across many pages and cannot be applied directly to a paid narrow-market Family account funnel.

### Readability

Unbounce’s broad dataset reported:

- pages written at approximately a 5th–7th grade reading level converted at 11.1%;
- professional-level writing converted at 5.3%.

Source: `https://unbounce.com/conversion-benchmark-report/`.

Interpretation: simple copy is a strong test priority; it is not proof that lowering reading level alone will double this funnel.

### Page performance

A 2026 web.dev case study reported that Nuvemshop improved LCP health and saw an 8.9% relative increase in mobile Google-organic conversion for the measured cohort.

Source: `https://web.dev/case-studies/nuvemshop`.

Interpretation: fast hero/media delivery and mobile performance are business priorities, especially because most social traffic is mobile.

### Welcome sequence

Mailchimp reports that a welcome-email series produces 51% more revenue on average than one welcome email in its published customer/automation material.

Source: `https://mailchimp.com/resources/make-lasting-connections-with-welcome-emails/`.

Interpretation: use a short sequence, but optimize it around activation rather than generic brand email.

### Activation behavior

Customer.io case studies report:

- Attio identified one “aha” action that more than doubled the chance of 30-day retention;
- Monarch Money replaced generic trial emails with behavior-triggered guidance and reported a 4.4% engagement lift and 3.36% decline in cancellations.

Sources:

- `https://customer.io/learn/case-studies/attio`
- `https://customer.io/learn/case-studies/monarch-money`

Interpretation: One Time must define and drive its own activation event—likely Student creation plus first live/recorded class use.

### Friction and surprise

Baymard’s checkout research reports:

- 39% cited unexpected additional costs;
- 19% cited forced account creation.

Source: `https://baymard.com/learn/reduce-cart-abandonment`.

One Time requires an account for secure Student access, so the lesson is not “remove the account.” The lesson is to minimize fields, explain why the account is required, grant immediate value, and eliminate surprise terms.

### Message match and personalization

An Unbounce School of Rock case study reports a 250% increase in monthly conversions and an 82% decrease in cost per conversion after using personalized pages matched to visitor keywords/locations.

Source: `https://unbounce.com/customer-case-study/school-of-rock/`.

This is a vendor case study, not a general guarantee. The relevant One Time principle is strict ad-to-landing message match.

## 6. Highest-priority One Time tests

### Acquisition creative

- Rabbi face/gesture vs Student reaction vs Mishnah screen as first frame;
- emotional hook vs concrete program proof;
- 7–10 seconds vs 15 seconds vs 25–30 seconds;
- music-led vs Rabbi voice-led;
- real class proof vs authority/headshot.

### Landing page

- headline: love of learning vs real rebbe vs one-perek accomplishment;
- hero: real active classroom vs split layout;
- short proof strip immediately under hero;
- testimonial location;
- signup form field count and sequence;
- CTA wording remains locked unless operator changes it.

### Activation

- first Student creation immediately after signup;
- calendar add;
- instant first recording;
- direct live-class access explanation;
- behavior-triggered reminders.

### Paid conversion

- price should not be changed during the first creative test;
- first test changes creative, not price and creative simultaneously;
- paid continuation messaging is tested after activation data exists.

## 7. One Time first-party market research plan

Public competitor pages are useful, but the narrow market must be learned directly.

### Parent interviews

Conduct 10–15 short interviews across:

- current families;
- former app families;
- warm WhatsApp referrals;
- parents who register but do not activate;
- parents who activate but do not continue.

Ask:

1. What problem were you trying to solve?
2. What made Rabbi Scheller feel different?
3. What almost stopped you from joining?
4. What other programs did you consider?
5. What would make this feel clearly worth $67/month?
6. What is the first result you want for your son?
7. Who in the family makes the final decision?

### Signup micro-survey

Optional post-signup, not another consent gate:

- How did you hear about us?
- What interested you most?
- What is your biggest concern?

### Source cohorts

Track separately:

- WhatsApp direct/referral;
- Facebook organic;
- Facebook paid;
- Instagram placement;
- YouTube;
- email;
- Rabbi personal referral;
- school/community referral even though schools are not the campaign target.

### Price research later

Do not change the launch price during initial acquisition testing.

After activation/retention data exists, research:

- willingness to pay;
- annual-plan interest;
- founding-family positioning;
- one-family vs one-child framing;
- retention at 30, 90, 180, and 365 days.

## 8. Metrics that answer the real business question

The real question is not “Did the video get views?”

It is:

```text
How many dollars did we spend
→ how many Families registered
→ how many activated
→ how many paid
→ how long did they stay?
```

Required formulas:

```text
registration_rate = registrations / landing_visitors
activation_rate = activated_families / registrations
free_to_paid_rate = paid_families / registrations
registration_CPA = spend_usd / registrations
activation_CPA = spend_usd / activated_families
paid_CAC = spend_usd / paid_families
payback_months = paid_CAC / monthly_contribution
contribution_LTV = monthly_contribution * average_paid_months
LTV_to_CAC = contribution_LTV / paid_CAC
```

Always record the denominator and time window.
