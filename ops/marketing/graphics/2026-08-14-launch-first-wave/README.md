# One Time — Launch First-Wave Graphics

**Date:** 2026-08-14

**Parent marketing authority:** PR #183 at `dd58c81636612886e0babd33f4eb0f93cd177753`

**Product authority:** PR #131 at `e73188fd1694e10b9e87e85a1ddbe65e046c93f4` — read only

**State:** Final-review drafts; not approved, scheduled, published, or used for spend

## Delivered scope

This bounded first wave supplies only the two launch concepts that do not already have legacy derivative packages:

| Current package | Current canonical hook | Output                   |
| --------------- | ---------------------- | ------------------------ |
| `OTM-CP-001`    | Classes Start Sunday   | One 1080×1350 feed draft |
| `OTM-CP-002`    | Get Free Access        | One 1080×1350 feed draft |

The drafts use the approved Rabbi-only `Class Photo - Rabbi Eli Teaching - Vertical 01.jpeg` and the text-free One Time white logo. No Student image, generated person, face modification, source-file move/rename, Drive write, Canva write, provider action, scheduling, publication, broadcast, boost, or spend occurred.

## Copy used

The copy follows the current launch authority:

- `GET FREE ACCESS`
- `AUG 16 · 7 PM ISRAEL`
- `No card required · Free through Sept 11`
- `join.onetimeonetime.com`

It does not use `Pre-register`, an unsupported “biggest class” claim, or the legacy placeholder `CTA — VERIFY BEFORE EXPORT`.

## Review boundary

These are feed-size drafts only. The 1080×1920 Story/Reel and optional 1080×1080 square versions must wait for operator visual approval of the base composition, matching the manual Canva work order. This packet does not authorize any external distribution.

## Reproduction

The renderer accepts a local folder containing the exact source files listed in `source-provenance.md` and rejects any hash mismatch:

```text
python render_launch_graphics.py --source-dir <approved-local-source-cache>
```

Generated files:

```text
renders/OTM-CP-001-feed-1080x1350.png
renders/OTM-CP-002-feed-1080x1350.png
visual-proof/first-wave-contact-sheet.png
render-manifest.json
```

Drive remains the source-media store. The repository contains only the deterministic renderer, bounded derivatives, proof, provenance, and registry records.
