# Visual QA - launch first wave

**State:** Agent visual QA passed; operator visual approval pending

## Inspected artifacts

- Original-resolution inspection of all eight deterministic PNG derivatives.
- Combined review in `visual-proof/first-wave-contact-sheet.png`.
- 390x844 phone-frame inspection of both 9:16 Story/Reel drafts and the mobile landing background in `visual-proof/first-wave-phone-proof.png`.
- Machine verification in `validation-report.json` and `render-manifest.json`.

## Findings

| Surface                     | Result          | Readback                                                                                          |
| --------------------------- | --------------- | ------------------------------------------------------------------------------------------------- |
| `OTM-CP-001` feed           | Pass            | Clear hook hierarchy, Rabbi remains visible, CTA/date/URL are legible, no crop collision.         |
| `OTM-CP-001` Story/Reel     | Pass            | 9:16 adaptation preserves the same message; key copy stays within the central phone-safe area.    |
| `OTM-CP-001` social preview | Pass            | 1200x630 split treatment keeps hook and Rabbi readable at preview scale.                          |
| `OTM-CP-002` feed           | Pass            | Offer hierarchy is clear; strengthened lower treatment protects text contrast.                    |
| `OTM-CP-002` Story/Reel     | Pass            | 9:16 adaptation keeps the Rabbi unobscured above the copy field and preserves phone-safe margins. |
| `OTM-CP-002` social preview | Pass            | 1200x630 split treatment keeps the offer, schedule, and URL readable without crowding the Rabbi.  |
| Landing desktop background  | Pass as handoff | 1600x900 text-free background keeps a left live-HTML safe zone and does not alter product code.   |
| Landing mobile background   | Pass as handoff | 1080x1600 text-free crop keeps Rabbi Eli visible and provides a lower live-HTML safe zone.        |

## Safety and accessibility

- Student-bearing derivatives: zero.
- Altered or generated faces: zero.
- Private data: zero.
- CTA drift: zero.
- Minimum proven foreground/background contrast: 4.85:1 against the worst-case photo-overlay background; required threshold: 4.5:1.
- Horizontal overflow/crop loss in the 390x844 phone proof: none for the Story/Reel canvases.
- Drive, Canva, product, provider, scheduling, publication, broadcast, boost, and spend effects: zero.

## Remaining review gate

This is an agent visual-QA result, not operator acceptance. Shloimie must approve or reject the contact sheet before any asset can move beyond `final_review`. Landing integration, scheduling, publication, and spend each remain separately unauthorized.
