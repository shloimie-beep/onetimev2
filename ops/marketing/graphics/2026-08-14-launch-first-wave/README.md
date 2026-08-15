# One Time - Launch First-Wave Graphics

**Initial packet:** 2026-08-14

**Current reconciliation:** 2026-08-15

**Parent marketing authority:** Draft PR #183 at `595e38b2c53c7f9dd1b0018ae1954e42061f07f4`

**Product authority:** PR #131 deployed source `0ed5c3955892450d8985765d622d5fb7809b5c95` - read only

**State:** Final-review drafts; not approved, integrated, scheduled, published, broadcast, boosted, or used for spend

## Delivered scope

This bounded first wave supplies only the two current launch concepts that do not already have legacy derivative packages:

| Current package | Current canonical hook | Deterministic draft derivatives                               |
| --------------- | ---------------------- | ------------------------------------------------------------- |
| `OTM-CP-001`    | Classes Start Sunday   | Feed 1080x1350, Story/Reel 1080x1920, social preview 1200x630 |
| `OTM-CP-002`    | Get Free Access        | Feed 1080x1350, Story/Reel 1080x1920, social preview 1200x630 |

The media work order also calls for a landing handoff. The packet therefore includes one shared text-free desktop background at 1600x900 and one shared text-free mobile background at 1080x1600. They preserve live HTML headline and CTA ownership in the product lane; no landing or PR #131 source changed.

Every derivative uses the approved Rabbi-only `Class Photo - Rabbi Eli Teaching - Vertical 01.jpeg`. The six social drafts also use the text-free One Time white logo. Their logos, foreground copy, CTA treatments, rules, and URLs remain at least 7% inside every applicable outer edge. No Student image, generated person, face modification, source-file move/rename, Drive write, Canva write, product write, provider action, scheduling, publication, broadcast, boost, or spend occurred.

## Locked copy

The social drafts preserve the current launch authority:

- `GET FREE ACCESS`
- `AUG 16 - 7 PM ISRAEL`
- `No card required - Free through Sept 11`
- `join.onetimeonetime.com`

They do not use `Pre-register`, claim the class is already the biggest in the world, or restore the legacy placeholder `CTA - VERIFY BEFORE EXPORT`.

The landing backgrounds intentionally contain no baked-in headline, offer, date, CTA, or URL. Product integration must retain the locked HTML hero `Help your son love learning Mishnayos.` and the live `GET FREE ACCESS` CTA if the backgrounds are separately accepted.

## Operator-review boundary

All eight assets remain `final_review`. Operator visual approval is still required before any asset may advance to `ready_to_schedule` or before either landing background is handed to the product integration lane. This packet contains no publication authorization and no publication event.

The 1080x1080 square backup remains omitted because the current work order calls it optional only when needed.

## Reproduction and validation

The renderer accepts a local folder containing the exact source files listed in `source-provenance.md` and rejects every hash mismatch:

```text
python render_launch_graphics.py --source-dir <approved-local-source-cache>
python validate_launch_graphics.py --source-dir <approved-local-source-cache> --write-report
```

Generated social drafts:

```text
renders/OTM-CP-001-feed-1080x1350.png
renders/OTM-CP-001-story-reel-1080x1920.png
renders/OTM-CP-001-social-preview-1200x630.png
renders/OTM-CP-002-feed-1080x1350.png
renders/OTM-CP-002-story-reel-1080x1920.png
renders/OTM-CP-002-social-preview-1200x630.png
```

Generated landing handoff and review evidence:

```text
renders/landing-hero-desktop-1600x900.png
renders/landing-hero-mobile-1080x1600.png
visual-proof/first-wave-contact-sheet.png
visual-proof/first-wave-phone-proof.png
render-manifest.json
validation-report.json
visual-qa.md
```

The validator proves exact source and output checksums, dimensions, content-registry JSON Schema conformance, exact CTA/destination linkage, 7% foreground safe zones, an actual 390x844 phone-proof content viewport, a minimum contrast ratio of 4.85:1, byte-exact rerendering, zero Student-bearing derivatives, and zero external effects.

Drive remains the source-media store. The repository contains only the deterministic renderer, bounded draft derivatives, proofs, provenance, registry records, and validation results.
