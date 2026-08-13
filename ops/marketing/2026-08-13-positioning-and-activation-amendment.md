# One Time Mishnayos — Positioning and Activation Amendment

**Date:** 2026-08-13  
**Status:** Current marketing amendment  
**Product integration:** PR #131 remains isolated

## Locked marketing decisions

- Keep the launch price at USD $67/month per Family. One Time is positioned as a premium daily live/hybrid Mishnayos experience, not as a low-cost recording library or generic Zoom class.
- Use `Mishnayos Made Memorable` as the campaign promise and recurring brand line.
- Keep the fixed cold-traffic landing headline: `Help your son love learning Mishnayos.`
- Keep one landing hero and CTA for the full Aug. 16–Sept. 11 campaign. Rotate ad hooks and creative, not the landing page.
- Fixed CTA: `GET FREE ACCESS`.
- Fixed form action: `CREATE YOUR FREE FAMILY ACCOUNT`.
- Approved community line: `Take part in building the biggest Mishnayos class in the world.` This is aspirational and must not claim the class is already the biggest.
- Do not add a launch survey or scripted market-research questionnaire.
- ChatGPT owns positioning, research, copy, attribution design, pipeline recommendations, and measurement definitions. Work Ultra/Codex performs bounded file/media execution only.
- `Mishnayos New` is mandatory primary source material. Previously approved One Time media may also be used.

## Parent activation

Current signup already attempts to establish the Parent session immediately and continue to the Parent overview. Preserve that behavior.

The launch activation path is:

```text
Family account created
→ Parent is already signed in
→ Create first Student
→ Student signs in
→ Join live or start the first recording
```

The Parent overview should prioritize `Create your first Student` before unrelated dashboard actions.

## Parent participation idea

A broader Parent/family learning role is a valuable later concept, but it is not an authorized launch change. It currently conflicts with the locked separation between Parent and Student access. Preserve the launch role model.

Record a later `Family Companion Mode` concept for a separate product decision. It may explore family review, Parent-labeled reflections, family goals/rewards, and Rabbi-visible family participation while keeping private Student interactions separate and preserving all three Student seats.

## Attribution

Use stable UTMs and stable creative IDs. Clicks and page views are attribution events, not pipeline stages.

Canonical campaign:

```text
utm_campaign=ot_launch_2026_free_access
```

Recommended source/medium pairs:

```text
facebook / organic_social
fb_ad / paid_social
instagram / organic_social
youtube / organic_short
whatsapp / status
whatsapp / forward
whatsapp / broadcast
ghl / email
rabbi_referral / direct_referral
community_referral / direct_referral
```

Always set `utm_content` to the stable creative ID.

## Pipeline recommendation

Before any live GHL mutation, audit exact pipeline IDs, stage IDs, counts, workflow dependencies, and rollback.

Recommended durable stages:

1. Lead Captured / Not Registered
2. Free Account Created / Student Setup Pending
3. Student Created / Not Activated
4. Activated Free Family
5. Engaged Free Family
6. Paid Continuation Pending
7. Paid Active
8. Grace / Payment Issue
9. Canceled / Former

Source cohorts such as old app, event, Facebook, WhatsApp, or YouTube belong in attribution fields, tags, and source metadata—not separate stages.

## Media consolidation

The execution worker must inventory before copying, hash before deduplication, preserve every original, and compare `Mishnayos New`, previously approved Drive media, and operator-provided local media locations. Missing originals may be copied to a controlled source-review folder; originals may not be moved, renamed, or deleted. Rabbi-facing derivative filenames must remain human-readable; technical lineage stays in the repo registry.