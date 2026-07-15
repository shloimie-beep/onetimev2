# OT-73 Implemented

- Restored the approved moving countdown ticker after the corrected addendum superseded the earlier ticker-removal instruction.
- The ticker uses `campaign.deadlineDate=2026-09-11` and `campaign.timezone=Asia/Jerusalem` from the existing campaign configuration, exposes a static accessible label, repeats moving visible text, and has a reduced-motion static state.
- Blocked stale public offer fragments from the hero/ticker: no `$67`, monthly price, trial, or `No card today` copy.
- Preserved `Member Login` -> `/login`; the canonical `/login` route is functional.
- Added local self-hosted DM Serif Display WOFF2 and applied it to the wordmark, hero, and major headings while keeping Inter/system sans for navigation, buttons, paragraphs, forms, and bullets.
- Enlarged the existing borderless One Time logo treatment to approximately 64px desktop and 48px mobile.
- Rendered the hero kicker as two distinct lines and kept the exact hero heading, schedule, and `Sign Up Now` CTA.
- Replaced the receive section with the approved heading, rectangular photo, feature panel, eyebrow, title, and six lead/body bullets.
- Replaced gain cards with the approved four result cards and intro, preserving Toronto as the Progress image and removing public provisional-copy disclaimers.
- Replaced the Who It's For copy with the approved four audiences and removed coverage/teacher-replacement language.
- Centered the teaching gallery, kept teaching photos in full color, and reduced slide captions to place names only.
- Added one shared landing/signup footer with logo, exact footer line, and ordered links.
- Added assertions for ticker presence/motion/reduced-motion, no stale price/no-card copy, header visibility, hero CTA above fold, receive/gain/who/gallery copy, footer contract, Toronto asset, lead behavior, bundle separation, accessibility, performance, and no overflow.
